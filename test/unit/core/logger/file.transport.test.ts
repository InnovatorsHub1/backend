import fs from 'fs';
import path from 'path';
import os from 'os';

import { FileTransport } from '@gateway/core/logger/transports/file.transport';
import { LogEntry } from '@gateway/core/logger/logger.interfaces';

// Helper function for delaying execution
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('FileTransport', () => {
  let logDir: string;
  let fileTransport: FileTransport;

  // Before each test, create a temporary log directory and initialize FileTransport
  beforeEach(() => {
    logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'filetransport-test-'));
    // Set a very low maxSize to trigger rotation quickly, and retention to a small value (e.g., 2)
    fileTransport = new FileTransport(logDir, 100, 2);
  });

  // After each test, remove the log directory
  afterEach(() => {
    fs.rmSync(logDir, { recursive: true, force: true });
  });

  it('should write a log entry to application.log', async () => {
    const logEntry: LogEntry = {
      level: 'info',
      message: 'write test',
      timestamp: new Date().toISOString(),
      service: 'TestService',
    };
    await fileTransport.write(logEntry);
    const logFilePath = path.join(logDir, 'application.log');
    expect(fs.existsSync(logFilePath)).toBe(true);
    const content = fs.readFileSync(logFilePath, 'utf8');
    expect(content).toContain('write test');
  });

  it('should rotate logs when the file size exceeds the maximum', async () => {
    const logEntry = {
      level: 'info',
      message: 'rotation test',
      timestamp: new Date().toISOString(),
      service: 'TestService',
    };
    // Write many log entries to exceed the maxSize limit
    for (let i = 0; i < 50; i++) {
      await fileTransport.write(logEntry);
    }
    // Wait a bit to allow asynchronous operations (such as compression) to finish
    await delay(1000);

    const files = fs.readdirSync(logDir);
    // Check that there are rotated logs that have been compressed (with .gz extension)
    const gzFiles = files.filter((file) => file.endsWith('.gz'));
    expect(gzFiles.length).toBeGreaterThan(0);
  });

  it('should compress the rotated log file and remove the uncompressed version', async () => {
    const logEntry = {
      level: 'info',
      message: 'compression test',
      timestamp: new Date().toISOString(),
      service: 'TestService',
    };
    // Write many log entries to trigger a rotation
    for (let i = 0; i < 50; i++) {
      await fileTransport.write(logEntry);
    }
    await delay(1000);

    const files = fs.readdirSync(logDir);
    // Ensure there is no rotated file without compression (e.g., application-TIMESTAMP.log without .gz)
    const rotatedUncompressed = files.filter((file) => /^application-.*\.log$/.test(file));
    expect(rotatedUncompressed.length).toBe(0);
    // Verify that there are compressed log files
    const gzFiles = files.filter((file) => file.endsWith('.gz'));
    expect(gzFiles.length).toBeGreaterThan(0);
  });

  it('should clean up old logs exceeding the retention limit', async () => {
    const logEntry = {
      level: 'info',
      message: 'cleanup test',
      timestamp: new Date().toISOString(),
      service: 'TestService',
    };
    // Write many entries to trigger multiple rotations
    for (let i = 0; i < 200; i++) {
      await fileTransport.write(logEntry);
    }
    // Wait additional time to allow all compression and cleanup operations to finish
    await delay(2000);

    const files = fs.readdirSync(logDir);
    const gzFiles = files.filter((file) => file.endsWith('.gz'));
    // Retention is set to 2, so there should be at most 2 compressed log files
    expect(gzFiles.length).toBeLessThanOrEqual(2);
  });
});

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
    
//     await new Promise((resolve) => setTimeout(resolve, 200));

//     const files = await readdir(testDir);
//     expect(files).toHaveLength(1);
    
//     const content = await readFile(join(testDir, files[0]), 'utf8');
//     expect(content.trim()).not.toBe(''); // Ensure file is not empty
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
