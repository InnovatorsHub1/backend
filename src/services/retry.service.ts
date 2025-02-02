import { WinstonLogger } from '../core/logger/winston.logger';
import { injectable } from 'inversify';
import { ApiError } from '../core/errors/api.error';

enum CircuitBreakerState {
  CLOSED,
  OPEN,
  HALF_OPEN
}

interface RetryMetrics {
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  lastFailureTime?: Date;
  averageResponseTime: number;
}

interface CircuitBreakerMetrics {
  state: CircuitBreakerState;
  failureCount: number;
  lastFailureTime?: Date;
  totalBreaks: number;
  lastBreakTime?: Date;
}

export interface RetryOptions {
  maxRetries: number;
  delay: number;
  exceptions: Array<new (...args: any[]) => Error>;
  strategy: RetryStrategy;
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
}

export type RetryStrategy = 'linear' | 'exponential' | 'random';

@injectable()
export class RetryService {
  private readonly logger = new WinstonLogger('RetryService');
  private readonly metrics = new Map<string, RetryMetrics>();
  private readonly circuitBreakers = new Map<string, CircuitBreakerMetrics>();
  private metricsInterval: NodeJS.Timeout | null = null;

  private static readonly DEFAULT_MAX_RETRIES = 3;
  private static readonly DEFAULT_DELAY = 1000;
  private static readonly MIN_DELAY = 100;
  private static readonly MAX_DELAY = 30000;
  private static readonly DEFAULT_THRESHOLD = 3;
  private static readonly DEFAULT_RESET_TIMEOUT = 5000;

  constructor() {
    if (process.env.NODE_ENV !== 'test') {
      this.metricsInterval = setInterval(() => this.reportMetrics(), 60000);
    }
  }

  async retryOnFailure<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {},
    operationId?: string
  ): Promise<T> {
    this.validateOperation(operation);

    const normalizedOptions = this.normalizeRetryOptions(options);
    const id = operationId || this.generateOperationId();
    const metrics = this.getOrCreateMetrics(id);
    let attempt = 0;

    while (attempt < normalizedOptions.maxRetries + 1) {
      const startTime = Date.now();

      try {
        metrics.totalAttempts++;
        const result = await operation();

        // ✅ Track successful attempts
        metrics.successfulAttempts++;
        metrics.averageResponseTime = this.updateAverageTime(
          metrics.averageResponseTime,
          Date.now() - startTime
        );

        return result;
      } catch (error) {
        metrics.failedAttempts++;
        metrics.lastFailureTime = new Date();

        if (!this.shouldRetry(error, normalizedOptions.exceptions)) {
          throw error;
        }

        if (attempt + 1 >= normalizedOptions.maxRetries + 1) {
          throw new ApiError(
            `Operation failed after ${attempt + 1} attempts`,
            500,
            'RetryService'
          );
        }

        const delay = this.calculateDelay(attempt, normalizedOptions);
        this.logger.warn(`Retry attempt ${attempt + 1}/${normalizedOptions.maxRetries}`, {
          error,
          delay,
          operationId: id
        });

        await this.delay(delay);
        attempt++;
      }
    }

    throw new ApiError(
      `Operation failed after ${normalizedOptions.maxRetries + 1} attempts`,
      500,
      'RetryService'
    );
  }

  async withCircuitBreaker<T>(
    operation: () => Promise<T>,
    options: Partial<CircuitBreakerOptions> = {},
    operationId?: string
  ): Promise<T> {
    this.validateOperation(operation);

    const normalizedOptions = this.normalizeCircuitBreakerOptions(options);
    const id = operationId || this.generateOperationId();
    const breaker = this.getOrCreateCircuitBreaker(id);

    if (breaker.state === CircuitBreakerState.OPEN) {
      const now = Date.now();
      const lastBreakTime = breaker.lastBreakTime?.getTime() || 0;

      if (now - lastBreakTime > normalizedOptions.resetTimeout) {
        breaker.state = CircuitBreakerState.HALF_OPEN;
        this.logger.info('Circuit breaker entering half-open state', { operationId: id });
      } else {
        throw new ApiError('Circuit breaker is open', 503, 'RetryService');
      }
    }

    try {
      const startTime = Date.now();
      const result = await operation();

      if (breaker.state === CircuitBreakerState.HALF_OPEN) {
        breaker.state = CircuitBreakerState.CLOSED;
        breaker.failureCount = 0;
        this.logger.info('Circuit breaker closed', { operationId: id });
      }

      // ✅ Track successful attempts
      const metrics = this.getOrCreateMetrics(id);
      metrics.successfulAttempts++;
      metrics.averageResponseTime = this.updateAverageTime(
        metrics.averageResponseTime,
        Date.now() - startTime
      );

      return result;
    } catch (error) {
      breaker.failureCount++;
      breaker.lastFailureTime = new Date();

      // ✅ Ensure breaker transitions to OPEN after failure threshold
      if (breaker.failureCount >= normalizedOptions.failureThreshold) {
        breaker.state = CircuitBreakerState.OPEN;
        breaker.lastBreakTime = new Date();
        breaker.totalBreaks = (breaker.totalBreaks || 0) + 1;

        this.logger.error('Circuit breaker opened', {
          operationId: id,
          failures: breaker.failureCount,
          totalBreaks: breaker.totalBreaks
        });

        throw new ApiError('Circuit breaker is open', 503, 'RetryService');
      }

      throw error;
    }
  }

  private validateOperation(operation: unknown): void {
    if (!operation || typeof operation !== 'function') {
      throw new ApiError('Invalid operation: function is required', 400, 'RetryService');
    }
  }

  /**
 * Retrieves or creates a circuit breaker for a given operation.
 */
private getOrCreateCircuitBreaker(id: string): CircuitBreakerMetrics {
    if (!this.circuitBreakers.has(id)) {
      this.circuitBreakers.set(id, {
        state: CircuitBreakerState.CLOSED,
        failureCount: 0,
        totalBreaks: 0
      });
    }
    return this.circuitBreakers.get(id)!;
  }

  private normalizeRetryOptions(options: Partial<RetryOptions>): RetryOptions {
    return {
      maxRetries: Math.max(0, options.maxRetries ?? RetryService.DEFAULT_MAX_RETRIES),
      delay: this.normalizeDelay(options.delay ?? RetryService.DEFAULT_DELAY),
      exceptions: options.exceptions ?? [Error],
      strategy: options.strategy ?? 'linear'
    };
  }

  /**
 * Ensures the delay is within the allowed range.
 */
   private normalizeDelay(delay: number): number {
    return Math.max(
      RetryService.MIN_DELAY,
      Math.min(delay, RetryService.MAX_DELAY)
    );
  }
  

  private normalizeCircuitBreakerOptions(options: Partial<CircuitBreakerOptions>): CircuitBreakerOptions {
    return {
      failureThreshold: Math.max(1, options.failureThreshold ?? RetryService.DEFAULT_THRESHOLD),
      resetTimeout: Math.max(1000, options.resetTimeout ?? RetryService.DEFAULT_RESET_TIMEOUT)
    };
  }

  /**
 * Generates a unique operation ID for tracking.
 */
private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
  
  /**
   * Retrieves or creates retry metrics for a given operation.
   */
  private getOrCreateMetrics(id: string): RetryMetrics {
    if (!this.metrics.has(id)) {
      this.metrics.set(id, {
        totalAttempts: 0,
        successfulAttempts: 0,
        failedAttempts: 0,
        averageResponseTime: 0
      });
    }
    return this.metrics.get(id)!;
  }
  

  private calculateDelay(attempt: number, options: RetryOptions): number {
    const baseDelay = options.delay;
    switch (options.strategy) {
        case 'linear':
            return baseDelay;
        case 'exponential':
            return Math.min(baseDelay * Math.pow(2, attempt), RetryService.MAX_DELAY);
        case 'random':
            const randomFactor = Math.random() * (1.5 - 0.5) + 0.5;
            return Math.min(baseDelay * randomFactor, RetryService.MAX_DELAY);
        default:
            return baseDelay;
    }
}

  private shouldRetry(error: unknown, exceptions: Array<new (...args: any[]) => Error>): boolean {
    return exceptions.some(Exception => error instanceof Exception);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private updateAverageTime(currentAvg: number, newValue: number): number {
    return currentAvg === 0 ? newValue : (currentAvg + newValue) / 2;
  }

  private reportMetrics(): void {
    this.logger.info('Retry Service Metrics', {
      totalOperations: this.metrics.size,
      operations: Array.from(this.metrics.entries()).map(([id, metrics]) => ({
        id,
        ...metrics,
        successRate: metrics.totalAttempts > 0 
          ? (metrics.successfulAttempts / metrics.totalAttempts) * 100 
          : 0
      }))
    });
  }

  public cleanup(): void {
    if (this.metricsInterval !== null) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
    this.metrics.clear();
    this.circuitBreakers.clear();
  }
}
