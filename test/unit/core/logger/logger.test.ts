import { ExtendedWinstonLogger } from '@gateway/core/logger/winston.logger.extended';
import { Logger } from 'winston';

describe('WinstonLogger - Masking Sensitive Data', () => {
  let logger: ExtendedWinstonLogger;
  let mockLogger: jest.Mocked<Logger>; // Properly typed mock logger

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      log: jest.fn(),
    } as unknown as jest.Mocked<Logger>; // Type assertion to satisfy Logger interface

    logger = new ExtendedWinstonLogger('TestService');
    Object.defineProperty(logger, 'logger', { value: mockLogger }); // Override private logger instance
  });

  test('should mask sensitive fields before logging via info method', () => {
    const logMeta = {
      userId: '12345',       // Should be masked
      ipAddress: '192.168.1.1',  // Should be masked
      correlationId: 'abc-123',   // Should be masked
      requestId: 'req-567',       // Should be masked
      nonSensitive: 'visibleData', // Should not be masked
    };

    logger.info('Test message', logMeta);

    expect(mockLogger.info).toHaveBeenCalledWith('Test message', {
      userId: '***MASKED***',
      ipAddress: '***MASKED***',
      correlationId: '***MASKED***',
      requestId: '***MASKED***',
      nonSensitive: 'visibleData', // Should remain unchanged
    });
  });
});
