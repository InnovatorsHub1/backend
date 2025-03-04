import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { promisify } from 'util';

import { LogEntry } from '../logger.interfaces';

// const writeFileAsync = promisify(fs.writeFile);
const appendFileAsync = promisify(fs.appendFile);
const renameAsync = promisify(fs.rename);
const unlinkAsync = promisify(fs.unlink);
const readdirAsync = promisify(fs.readdir);

export class FileTransport {
  name: string = 'FileTransport';
  private logDir: string;
  private maxSize: number;
  private retention: number;
  private currentFile: string;

  constructor(logDir: string, maxSize: number = 5 * 1024 * 1024, retention: number = 7) {
    this.logDir = logDir;
    this.maxSize = maxSize;
    this.retention = retention;
    this.currentFile = path.join(logDir, 'application.log');
    
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  async write(entry: LogEntry): Promise<void> {
    const logMessage = `${JSON.stringify(entry)  }\n`;
    try {
      if (fs.existsSync(this.currentFile) && fs.statSync(this.currentFile).size >= this.maxSize) {
        await this.rotateLogs();
      }
      await appendFileAsync(this.currentFile, logMessage);
    } catch (error) {
      console.error('Failed to write log:', error);
    }
  }

  private async rotateLogs(): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rotatedFile = path.join(this.logDir, `application-${timestamp}.log`);
    await renameAsync(this.currentFile, rotatedFile);
    await this.compressLog(rotatedFile);
    await this.cleanupOldLogs();
  }

  private async compressLog(filePath: string): Promise<void> {
    return new Promise(
      (resolve, reject) => {
        const compressedFile = `${filePath}.gz`;
        const fileContents = fs.createReadStream(filePath);
        const writeStream = fs.createWriteStream(compressedFile);
        const gzip = zlib.createGzip();
        
        fileContents
          .pipe(gzip)
          .pipe(writeStream)
          .on('finish', async() => {
            try {
              await unlinkAsync(filePath);
              resolve();
            } catch (err) {
              reject(err);
            }
          })
          .on('error', (err) => {
            reject(err);
          });
      },
    );
  }

  private async cleanupOldLogs(): Promise<void> {
    try {
      const files = await readdirAsync(this.logDir);
      const logFiles = files.filter((file) => file.endsWith('.gz'))
        .map((file) => ({ file, time: fs.statSync(path.join(this.logDir, file)).ctime.getTime() }))
        .sort((a, b) => b.time - a.time);
      
      while (logFiles.length > this.retention) {
        const oldLog = logFiles.pop();
        if (oldLog) {await unlinkAsync(path.join(this.logDir, oldLog.file));}
      }
    } catch (error) {
      console.error('Failed to clean up old logs:', error);
    }
  }
}


// import { createWriteStream, WriteStream, createReadStream } from 'fs';
// import { readdir, unlink, chmod  } from 'fs/promises';
// import { createGzip } from 'zlib';
// import { join } from 'path';

// import { LogTransport, LogEntry } from '../logger.interfaces';
// import { ExtendedWinstonLogger } from '../winston.logger.extended';

// /**
//  * FileTransport implements log file management with rotation, compression and retention policies
//  * @implements {LogTransport}
//  */
// export class FileTransport implements LogTransport {
//   /** Transport name identifier */
//   name = 'file';
//   private logger: ExtendedWinstonLogger;
//   private stream: WriteStream;
//   private currentSize = 0;
//   private maxSize: number;
//   private logDir: string;
//   private rotationInterval: number;
//   private lastRotation: number;
//   private retentionDays: number;
//   private buffer: LogEntry[] = [];
//   private bufferSize = 100;

//   /**
//    * Creates a new FileTransport instance
//    * @param {Object} options - Configuration options
//    * @param {string} options.filename - Base name for log files
//    * @param {number} [options.maxSize=10485760] - Maximum file size in bytes (default 10MB)
//    * @param {string} [options.logDir='logs'] - Directory for log files
//    * @param {number} [options.rotationInterval=86400000] - Rotation interval in milliseconds (default 24h)
//    * @param {number} [options.retentionDays=30] - Number of days to keep log files
//    */
//   constructor(options: {
//     filename: string;
//     maxSize?: number;
//     logDir?: string;
//     rotationInterval?: number; // in milliseconds
//     retentionDays?: number;
//   }) {
//     this.logger = new ExtendedWinstonLogger('FileTransport');
//     this.maxSize = options.maxSize || 10 * 1024 * 1024; // 10MB default
//     this.logDir = options.logDir || 'logs';
//     this.rotationInterval = options.rotationInterval || 24 * 60 * 60 * 1000; // 24 hours default
//     this.retentionDays = options.retentionDays || 30;
//     this.lastRotation = Date.now();

//     const logPath = join(this.logDir, options.filename);
//     this.stream = createWriteStream(logPath, { flags: 'a' });
//     this.setFilePermissions(logPath).then(() => {
//       this.logger.info(`File permissions set for ${logPath}`);
//     }).catch((error) => {
//       this.logger.error(`Failed to set file permissions: ${error.message}`);
//     });

//     setInterval(() => this.applyRetentionPolicy(), 24 * 60 * 60 * 1000); // Run retention check daily
//   }

//   //Core Setup ---------------------------------------------------------------
//   /**
//    * Creates a new write stream for log files
//    * @param {string} filename - Name of log file
//    * @private
//    */
//   private async createStream(filename: string): Promise<WriteStream> {
//     const logPath = join(this.logDir, filename);

//     try {
//       await this.setFilePermissions(logPath);
//       this.logger.info(`File permissions set for ${logPath}`);
      
//       return createWriteStream(logPath, { flags: 'a' });
//     } catch (error) {
//       if (error instanceof Error) {
//         this.logger.error(`Failed to create write stream: ${error.message}`);
//       }
//       throw error;
//     }
//   }

//   /**
//    * Sets file permissions for log files
//    * @param {string} filePath - Path to log file
//    * @private
//    */
//   private async setFilePermissions(filePath: string): Promise<void> {
//     await chmod(filePath, 0o640); // Owner read/write, group read
//   }

//   //Write Operations ------------------------------------------------------
//   /**
//    * Writes log entry to buffer and manages write queue
//    * @param {LogEntry} entry - Log entry to write
//    * @returns {Promise<void>}
//    */
//   async write(entry: LogEntry): Promise<void> {
//     this.buffer.push(entry);
    
//     this.writeQueue = this.writeQueue.then(async () => {
//       if (this.buffer.length >= this.bufferSize) {
//         if (this.shouldRotate(Date.now())) {
//           await this.rotate();
//         }
//         await this.flushBuffer();
//       }
//     });

//     return this.writeQueue;
//   }
//   private writeQueue: Promise<void> = Promise.resolve();

//   /**
//    * Flushes buffered log entries to disk
//    * @private
//    */
//   private async flushBuffer(): Promise<void> {
//     if (this.buffer.length === 0) {return;}
    
//     const entries = this.buffer.splice(0);
//     for (const entry of entries) {
//       const logLine = `${JSON.stringify(entry)  }\n`;
//       this.currentSize += Buffer.byteLength(logLine);
//       this.stream.write(logLine);
//     }
//   }

//   //Rotation Logic ----------------------------------------------------------
//   /**
//    * Checks if log rotation is needed
//    * @param {number} now - Current timestamp
//    * @private
//    */
//   private shouldRotate(now: number): boolean {
//     return this.currentSize >= this.maxSize || now - this.lastRotation >= this.rotationInterval;
//   }

//   /**
//    * Performs log file rotation
//    * @private
//    */
//   private async rotate(): Promise<void> {
//     await new Promise((resolve) => this.stream.end(resolve));
//     const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
//     const oldFileName = this.stream.path.toString();
//     const newFileName = `app-${timestamp}.log`;

//     await this.compressFile(oldFileName);
//     this.lastRotation = Date.now();
//     this.currentSize = 0;
//     this.stream = await this.createStream(newFileName);
//   }

//   /**
//    * Compresses log file using gzip
//    * @param {string} filename - File to compress
//    * @private
//    */
//   private async compressFile(filename: string): Promise<void> {
//     const gzip = createGzip();
//     const source = createReadStream(join(this.logDir, filename));
//     const destination = createWriteStream(join(this.logDir, `${filename}.gz`));

//     await new Promise<void>((resolve, reject) => {
//       source
//         .pipe(gzip)
//         .pipe(destination)
//         .on('finish', () => resolve())
//         .on('error', reject);
//     });

//     await unlink(join(this.logDir, filename));
//   }

//   //File Management --------------------------------------------------------
//   /**
//    * Applies retention policy to remove old log files
//    * @private
//    */
//   private async applyRetentionPolicy(): Promise<void> {
//     const files = await readdir(this.logDir);
//     const now = Date.now();
//     const maxAge = this.retentionDays * 24 * 60 * 60 * 1000;

//     for (const file of files) {
//       const filePath = join(this.logDir, file);
//       const fileDate = this.extractDateFromFilename(file);

//       if (fileDate && now - fileDate.getTime() > maxAge) {
//         await unlink(filePath);
//       }
//     }
//   }

//   /**
//    * Extracts date from log filename
//    * @param {string} filename - Log filename
//    * @returns {Date|null} Extracted date or null if invalid format
//    * @private
//    */
//   private extractDateFromFilename(filename: string): Date | null {
//     const match = filename.match(/app-(.+)\.(log|gz)$/);

//     return match ? new Date(match[1].replace(/-/g, ':')) : null;
//   }

// }
