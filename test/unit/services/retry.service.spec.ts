import { RetryService } from '../../../src/services/retry.service';
import { ApiError } from '../../../src/core/errors/api.error';

jest.mock('../../../src/core/logger/winston.logger');

describe('RetryService', () => {
    let retryService: RetryService;

    beforeEach(() => {
        retryService = new RetryService();
        jest.clearAllMocks(); // Clears any previous calls to mock functions
        jest.setTimeout(10000);
    });

    afterEach(() => {
        retryService.cleanup();
    });

    describe('retryOnFailure', () => {
        it('should successfully retry the operation until it succeeds', async () => {
            const operation = jest.fn()
                .mockRejectedValueOnce(new Error('Temporary error'))
                .mockResolvedValue('Success');
            
            const result = await retryService.retryOnFailure(operation, {
                maxRetries: 2,
                delay: 100,
                exceptions: [Error],
                strategy: 'linear'
            });

            expect(result).toBe('Success');
            expect(operation).toHaveBeenCalledTimes(2);
        });

        it('should throw an error after exceeding max retries', async () => {
            const operation = jest.fn().mockRejectedValue(new ApiError('Persistent error', 500, 'RetryService'));
            
            await expect(retryService.retryOnFailure(operation, {
                maxRetries: 1,
                delay: 100,
                exceptions: [ApiError],
                strategy: 'linear'
            })).rejects.toThrow('Operation failed after 2 attempts');

            expect(operation).toHaveBeenCalledTimes(2);
        });

    });

    describe('withCircuitBreaker', () => {
        it('should open the circuit breaker after consecutive failures', async () => {
            const operation = jest.fn()
                .mockRejectedValueOnce(new ApiError('Service Unavailable', 503, 'RetryService'))
                .mockRejectedValueOnce(new ApiError('Service Unavailable', 503, 'RetryService'))
                .mockResolvedValue('Success');  // This line won't be reached but included for completeness
        
            // Perform the operation until it fails enough times to open the circuit breaker
            await expect(retryService.withCircuitBreaker(operation, {
                failureThreshold: 1, // Set threshold to 1 for quick failure
                resetTimeout: 1000
            })).rejects.toThrow('Circuit breaker is open');
        
            await expect(retryService.withCircuitBreaker(operation, {
                failureThreshold: 1,
                resetTimeout: 1000
            })).rejects.toThrow('Circuit breaker is open');
        
            expect(operation).toHaveBeenCalledTimes(2); // Ensure it was called exactly twice
        });

        it('should reset the circuit breaker state after the timeout', async () => {
            jest.useFakeTimers();
            const operation = jest.fn()
                .mockRejectedValueOnce(new ApiError('Service Unavailable', 503, 'RetryService'))
                .mockResolvedValue('Success');
            
            // First attempt - fail
            await expect(retryService.withCircuitBreaker(operation, {
                failureThreshold: 1,
                resetTimeout: 1000
            })).rejects.toThrow('Circuit breaker is open');

            // Advance timers to simulate timeout
            jest.advanceTimersByTime(1000);

            // Second attempt - should succeed
            await expect(retryService.withCircuitBreaker(operation, {
                failureThreshold: 1,
                resetTimeout: 1000
            })).resolves.toBe('Success');
            jest.useRealTimers();
        });
    });


});
        
