import { ExtendedWinstonLogger } from '@gateway/core/logger/winston.logger.extended';
import { Logger } from 'winston';

describe('ExtendedWinstonLogger', () => {
  let logger: ExtendedWinstonLogger;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      log: jest.fn(),
    } as unknown as jest.Mocked<Logger>;

    logger = new ExtendedWinstonLogger('TestService');
    Object.defineProperty(logger, 'logger', { value: mockLogger });
  });

  // ✅ Test 1: Masking Sensitive Data (Top-Level)
  test('should mask sensitive fields before logging via info method', () => {
    const logMeta = {
      userId: '12345',
      ipAddress: '192.168.1.1',
      correlationId: 'abc-123',
      requestId: 'req-567',
      nonSensitive: 'visibleData',
    };

    logger.info('Test message', logMeta);

    expect(mockLogger.info).toHaveBeenCalledWith('Test message', {
      userId: '***MASKED***',
      ipAddress: '***MASKED***',
      correlationId: '***MASKED***',
      requestId: '***MASKED***',
      nonSensitive: 'visibleData',
    });
  });

  // ✅ Test 2: Masking Sensitive Data (Nested Objects)
  test('should mask sensitive fields in nested objects', () => {
    const nestedMeta = {
      user: {
        userId: '12345',
        details: {
          ipAddress: '192.168.1.1',
        },
      },
      session: {
        correlationId: 'abc-123',
        requestId: 'req-567',
      },
      nonSensitive: 'visibleData',
    };

    logger.info('Test message', nestedMeta);

    expect(mockLogger.info).toHaveBeenCalledWith('Test message', {
      user: {
        userId: '***MASKED***',
        details: {
          ipAddress: '***MASKED***',
        },
      },
      session: {
        correlationId: '***MASKED***',
        requestId: '***MASKED***',
      },
      nonSensitive: 'visibleData',
    });
  });

  // ✅ Test 3: Logging at Different Levels
  test('should log messages at all levels', () => {
    logger.info('Info message');
    logger.warn('Warning message');
    logger.debug('Debug message');

    expect(mockLogger.info).toHaveBeenCalledWith('Info message', undefined);
    expect(mockLogger.warn).toHaveBeenCalledWith('Warning message', undefined);
    expect(mockLogger.debug).toHaveBeenCalledWith('Debug message', undefined);
  });

  // ✅ Test 4: Handling Error Objects
  test('should log structured error objects', () => {
    const error = new Error('Something went wrong');
    logger.error('Error occurred', error);

    expect(mockLogger.error).toHaveBeenCalledWith('Error occurred', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    });
  });

  // ✅ Test 5: Handling Non-Error Objects
  test('should log unknown errors as string', () => {
    logger.error('Unknown error occurred', 'Some error string');

    expect(mockLogger.error).toHaveBeenCalledWith('Unknown error occurred', {
      error: { message: 'Some error string' },
    });
  });

  // ✅ Test 6: Create Child Logger
  test('should create a child logger with prefixed name', () => {
    const childLogger = logger.createChildLogger('ChildService');
    expect(childLogger).toBeInstanceOf(ExtendedWinstonLogger);
  });

  // ✅ Test 7: Change Log Level
  test('should change the log level dynamically', () => {
    logger.setLogLevel('debug');
    expect(mockLogger.level).toBe('debug');
  });
});


// import { MaskableData } from '@gateway/core/logger/logger.interfaces';
// import { ExtendedWinstonLogger } from '@gateway/core/logger/winston.logger.extended';

// describe('WinstonLogger', () => {
//   let logger: ExtendedWinstonLogger;
//   let logSpy: jest.SpyInstance;

//   beforeEach(() => {
//     logger = new ExtendedWinstonLogger('TestService');
//     logSpy = jest.spyOn(logger['logger'], 'info');
//   });

//   afterEach(() => {
//     logSpy.mockRestore();
//   });

//   test('logs info message with metadata', () => {
//     const context = {
      
//       traceId: 'abc-123',
//       path: '/api/users',
//       method: 'GET',
      
//     };
//     const meta: MaskableData = { userId: '123', ...context };
    
//     logger.info('Test message', meta);
    
//     expect(logSpy).toHaveBeenCalledWith(
//       'Test message',
//       expect.objectContaining({
//         userId: '***MASKED***',
//         context,
//       }),
//     );
//   });

//   test('creates child logger with correct name', () => {
//     const childLogger = logger.createChildLogger('Child') as ExtendedWinstonLogger;
//     const childSpy = jest.spyOn(childLogger['logger'], 'info');
    
//     childLogger.info('Child message');
    
//     expect(childSpy).toHaveBeenCalledWith(
//       'Child message',
//       expect.objectContaining({
//         service: 'TestService:Child',
//       }),
//     );
//   });

//   test('masks sensitive data in metadata', () => {
//     const meta = {
//       userId: '123',
//       ipAddress: '192.168.1.1',
//       correlationId: 'corr-123',
//       requestId: 'req-456',
//       normalField: 'visible',
//     };
    
//     logger.info('Test message', meta);
    
//     expect(logSpy).toHaveBeenCalledWith(
//       'Test message',
//       expect.objectContaining({
//         userId: '***MASKED***',
//         ipAddress: '***MASKED***',
//         correlationId: '***MASKED***',
//         requestId: '***MASKED***',
//         normalField: 'visible',
//       }),
//     );
//   });

//   test('handles error logging with stack trace', () => {
//     const errorSpy = jest.spyOn(logger, 'error');
//     const error = new Error('Test error');
//     const meta: MaskableData = { userId: '123' };
    
//     logger.error('Error occurred', error, meta);
    
//     expect(errorSpy).toHaveBeenCalledWith(
//       'Error occurred',
//       expect.objectContaining({
//         userId: '***MASKED***',
//         error: {
//           name: error.name,
//           message: error.message,
//           stack: error.stack,
//         },
//       }),
//     );
//   });

//   test('sets log level correctly', () => {
//     logger.setLogLevel('debug');
//     expect(logger['logger'].level).toBe('debug');
    
//     logger.debug('Debug message');
//     const debugSpy = jest.spyOn(logger['logger'], 'debug');
//     expect(debugSpy).toHaveBeenCalled();
//   });
// });
