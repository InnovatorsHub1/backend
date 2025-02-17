// import { WinstonLogger } from '@gateway/core/logger/winston.logger';
// import { MaskableData } from '@gateway/core/logger/logger.interfaces';

// describe('WinstonLogger', () => {
//   let logger: WinstonLogger;
//   let logSpy: jest.SpyInstance;

//   beforeEach(() => {
//     logger = new WinstonLogger('TestService');
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
//     const childLogger = logger.createChildLogger('Child') as WinstonLogger;
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
