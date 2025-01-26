import { App } from './app';
import { WinstonLogger } from './core/logger/winston.logger';


const logger = new WinstonLogger('Main');

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception', { error });
  process.exit(1);
});

process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled Rejection', { reason });
  process.exit(1);
});

const startServer = async () => {
  try {
    const app = new App();
    await app.start();
  } catch (error) {
    logger.error('Failed to start application', { error });
    process.exit(1);
  }
};

startServer();