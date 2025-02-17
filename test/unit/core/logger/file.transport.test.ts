// import { mkdir, readdir, unlink, readFile } from 'fs/promises';
// import { join } from 'path';

// import { LogEntry } from '@gateway/core/logger/logger.interfaces';
// import { FileTransport } from '@gateway/core/logger/transports/file.transport';

// describe('FileTransport', () => {
//   const testDir = 'test-logs';
//   let transport: FileTransport;

//   beforeEach(async () => {
//     await mkdir(testDir, { recursive: true });
//     transport = new FileTransport({
//       filename: 'test.log',
//       logDir: testDir,
//       maxSize: 1024, // Small size for testing rotation
//       rotationInterval: 1000, // Short interval for testing
//     });
//   });

//   afterEach(async () => {
//     jest.clearAllTimers();
//     const files = await readdir(testDir);
//     await Promise.all(files.map((file) => unlink(join(testDir, file))));
//   });

//   test('writes log entry to file', async () => {
//     const entry: LogEntry = {
//       timestamp: new Date().toISOString(),
//       level: 'info',
//       message: 'Test message',
//       service: 'test',
//     };
//     await transport.write(entry);
    
//     await new Promise((resolve) => setTimeout(resolve, 100));

//     const files = await readdir(testDir);
//     expect(files).toHaveLength(1);
    
//     const content = await readFile(join(testDir, files[0]), 'utf8');
//     const parsed = JSON.parse(content);
//     expect(parsed).toMatchObject(entry);
//   });

//   test('rotates log file when size exceeded', async () => {
//     const entry: LogEntry = {
//       timestamp: new Date().toISOString(),
//       level: 'info',
//       message: 'A'.repeat(512), // Large message to trigger rotation
//       service: 'test',
//     };

//     // Write enough entries to trigger rotation
//     await Promise.all([
//       transport.write(entry),
//       transport.write(entry),
//       transport.write(entry),
//     ]);

//     await new Promise((resolve) => setTimeout(resolve, 100));

//     const files = await readdir(testDir);
//     expect(files.length).toBeGreaterThan(1);
//     expect(files.some((f) => f.endsWith('.gz'))).toBe(true);
//   });

//   test('compresses rotated files', async () => {
//     const entry: LogEntry = {
//       timestamp: new Date().toISOString(),
//       level: 'info',
//       message: 'Test compression',
//       service: 'test',
//     };

//     // Write and trigger rotation
//     await transport.write(entry);
//     await new Promise((resolve) => setTimeout(resolve, 1200)); // Wait for rotation
//     await transport.write(entry);
//     await new Promise((resolve) => setTimeout(resolve, 100));

//     const files = await readdir(testDir);
//     expect(files.some((f) => f.endsWith('.gz'))).toBe(true);
//   });

//   test('applies retention policy', async () => {
//     const oldEntry: LogEntry = {
//       timestamp: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(), // 31 days old
//       level: 'info',
//       message: 'Old message',
//       service: 'test',
//     };

//     await transport.write(oldEntry);
//     await new Promise((resolve) => setTimeout(resolve, 100));
//     await transport['applyRetentionPolicy']();
//     await new Promise((resolve) => setTimeout(resolve, 100));

//     const files = await readdir(testDir);
//     expect(files).toHaveLength(0);
//   });

//   test('handles write queue correctly', async () => {
//     const entries = Array.from({ length: 10 }, (_, i) => ({
//       timestamp: new Date().toISOString(),
//       level: 'info',
//       message: `Message ${i}`,
//       service: 'test',
//     }));

//     await Promise.all(entries.map((entry) => transport.write(entry)));
//     await new Promise((resolve) => setTimeout(resolve, 100));
    
//     const files = await readdir(testDir);
//     const content = await readFile(join(testDir, files[0]), 'utf8');
//     const lines = content.trim().split('\n');
//     expect(lines).toHaveLength(10);
//   });
// });
