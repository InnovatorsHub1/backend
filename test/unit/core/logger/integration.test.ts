// import { mkdir, readdir, readFile, unlink } from 'fs/promises';
// import { join } from 'path';

// import { FileTransport } from '@gateway/core/logger/transports/file.transport';
// import { ExtendedWinstonLogger } from '@gateway/core/logger/winston.logger.extended';


// describe('Logger Integration', () => {
//   const logDir = 'test-logs';
//   let logger: ExtendedWinstonLogger;
//   let fileTransport: FileTransport;
//   let logSpy: jest.SpyInstance;

//   beforeEach(async () => {
//     await mkdir(logDir, { recursive: true });
//     logger = new ExtendedWinstonLogger('IntegrationTest');
//     fileTransport = new FileTransport({
//       filename: 'integration.log',
//       logDir,
//       maxSize: 1024,
//       rotationInterval: 1000,
//     });
//     logSpy = jest.spyOn(logger, 'info');
//   });

//   afterEach(async () => {
//     logSpy.mockRestore();
//     jest.clearAllTimers();
//     const files = await readdir(logDir);
//     await Promise.all(files.map((file) => unlink(join(logDir, file))));
//   });

//   test('logs through multiple transports', async () => {
//     const testMessage = 'Integration test message';
//     const context = {
//       'request-123': {
//         traceId: 'abc-123',
//         path: '/api/users',
//         method: 'GET',
//       },
//     };
//     const testMeta = { userId: '123', context };

//     // Test all log levels
//     logger.info(testMessage, testMeta);
//     logger.error('Error message', new Error('Test error'), testMeta);
//     logger.warn('Warning message', testMeta);
//     logger.debug('Debug message', testMeta);

//     await new Promise((resolve) => setTimeout(resolve, 100));

//     // Verify logger spy
//     expect(logSpy).toHaveBeenCalled();
    
//     // Verify file output
//     const logContent = await readFile(join(logDir, 'integration.log'), 'utf8');
//     expect(logContent).toContain(testMessage);
//     expect(logContent).toContain('***MASKED***');

//     // Verify log structure
//     const logLines = logContent.trim().split('\n');
//     const parsedLog = JSON.parse(logLines[0]);
//     expect(parsedLog).toHaveProperty('timestamp');
//     expect(parsedLog).toHaveProperty('level');
//     expect(parsedLog).toHaveProperty('message', testMessage);
//     expect(parsedLog).toHaveProperty('service', 'IntegrationTest');

//     // Verify transport setup
//     expect(logger).toBeDefined();
//     expect(fileTransport).toBeDefined();
//   });
// });
