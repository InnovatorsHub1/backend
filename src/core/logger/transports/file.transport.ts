import { createWriteStream, WriteStream, createReadStream } from 'fs';
import { readdir, unlink } from 'fs/promises';
import { createGzip } from 'zlib';
import { join } from 'path';

import { WinstonLogger } from '../winston.logger';
import { LogTransport, LogEntry } from '../logger.interfaces';

export class FileTransport implements LogTransport {
  name = 'file';
  private logger: WinstonLogger;
  private stream: WriteStream;
  private currentSize = 0;
  private maxSize: number;
  private logDir: string;
  private rotationInterval: number;
  private lastRotation: number;
  private retentionDays: number;

  constructor(options: {
    filename: string;
    maxSize?: number;
    logDir?: string;
    rotationInterval?: number; // in milliseconds
    retentionDays?: number;
  }) {
    this.logger = new WinstonLogger('FileTransport');
    this.maxSize = options.maxSize || 10 * 1024 * 1024; // 10MB default
    this.logDir = options.logDir || 'logs';
    this.rotationInterval = options.rotationInterval || 24 * 60 * 60 * 1000; // 24 hours default
    this.retentionDays = options.retentionDays || 30;
    this.lastRotation = Date.now();
    this.stream = this.createStream(options.filename);

    // Run retention check daily
    setInterval(() => this.applyRetentionPolicy(), 24 * 60 * 60 * 1000);
  }

  private createStream(filename: string): WriteStream {
    const logPath = join(this.logDir, filename);

    try {
      return createWriteStream(logPath, { flags: 'a' });
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(`Failed to create write stream: ${error.message}`);
      }
      throw error;
    }
  }

  private writeQueue: Promise<void> = Promise.resolve();

  async write(entry: LogEntry): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      const logLine = `${JSON.stringify(entry)  }\n`;
      if (this.shouldRotate(Date.now())) {
        await this.rotate();
      }
      this.currentSize += Buffer.byteLength(logLine);
      this.stream.write(logLine);
    });
    
    return this.writeQueue;
  }

  private shouldRotate(now: number): boolean {
    return this.currentSize >= this.maxSize || now - this.lastRotation >= this.rotationInterval;
  }

  private async rotate(): Promise<void> {
    await new Promise((resolve) => this.stream.end(resolve));
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const oldFileName = this.stream.path.toString();
    const newFileName = `app-${timestamp}.log`;

    await this.compressFile(oldFileName);
    this.lastRotation = Date.now();
    this.currentSize = 0;
    this.stream = this.createStream(newFileName);
  }
  
  private async compressFile(filename: string): Promise<void> {
    const gzip = createGzip();
    const source = createReadStream(join(this.logDir, filename));
    const destination = createWriteStream(join(this.logDir, `${filename}.gz`));

    await new Promise<void>((resolve, reject) => {
      source
        .pipe(gzip)
        .pipe(destination)
        .on('finish', () => resolve())
        .on('error', reject);
    });

    // Remove original file after compression
    await unlink(join(this.logDir, filename));
  }

  private async applyRetentionPolicy(): Promise<void> {
    const files = await readdir(this.logDir);
    const now = Date.now();
    const maxAge = this.retentionDays * 24 * 60 * 60 * 1000;

    for (const file of files) {
      const filePath = join(this.logDir, file);
      const fileDate = this.extractDateFromFilename(file);

      if (fileDate && now - fileDate.getTime() > maxAge) {
        await unlink(filePath);
      }
    }
  }

  private extractDateFromFilename(filename: string): Date | null {
    const match = filename.match(/app-(.+)\.(log|gz)$/);

    return match ? new Date(match[1].replace(/-/g, ':')) : null;
  }

}
