import express, { Application } from 'express';
import http from 'http';
import { Routes } from './routes';
import { config } from './config';
import { WinstonLogger } from './core/logger/winston.logger';
import { setupSecurityMiddleware } from './middleware/security.middleware';
import { errorMiddleware } from './middleware/error.middleware';
import { requestId } from './middleware/request-id.middleware';
import { requestLogger } from './middleware/request-logger.middleware';

const logger = new WinstonLogger('App');

export class App {
 private app: Application;
 private server!: http.Server; 

 constructor() {
   this.app = express();
   this.setupMiddleware();
   this.setupRoutes();
   this.setupErrorHandling();
   process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
 }

 private setupMiddleware(): void {
    this.app.use(requestId);
    this.app.use(requestLogger);
    setupSecurityMiddleware(this.app);
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
 }

 
 private async shutdown(): Promise<void> {
  await this.stop();
  process.exit(0);
 }

 private setupRoutes(): void {
   new Routes(this.app);
 }


 private setupErrorHandling(): void {
   this.app.use(errorMiddleware);
 }

 public getServer() {
  return this.app;
 }

 public async start(): Promise<void> {
  try {
    if (!config.port || isNaN(config.port)) {
      throw new Error('Invalid port configuration');
    }

    this.server = this.app.listen(config.port, () => {
      logger.info(`Server started on port ${config.port}`);
      logger.info(`Health check endpoint: ${config.baseUrl}/health`);
      logger.info(`Node environment: ${config.nodeEnv}`);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    throw error;
  }
}

public async stop(): Promise<void> {
  if (this.server) {
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
    logger.info('Server stopped');
  }
}
}