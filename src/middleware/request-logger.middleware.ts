import morgan from 'morgan';
import { Request } from 'express';
import { WinstonLogger } from '../core/logger/winston.logger';

const logger = new WinstonLogger('HTTP');

morgan.token('req-id', (req: Request) => req.id);

export const requestLogger = morgan(':req-id :method :url :status :response-time ms', {
 stream: {
   write: (message) => logger.info(message.trim())
 }
});