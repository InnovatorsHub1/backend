import winston, { Logger, format, transports } from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';
import { ILogger } from '../../types';
import { config } from '../../config';

export class WinstonLogger implements ILogger {
  private logger: Logger;

  constructor(serviceName: string) {
    const { combine, timestamp, colorize, printf } = format;

    const logFormat = printf(({ level, message, timestamp, ...meta }) => {
      return `${timestamp} [${serviceName}] ${level}: ${message} ${
        Object.keys(meta).length ? JSON.stringify(meta) : ''
      }`;
    });

    const transportArray: winston.transport[] = [
      new transports.Console({
        format: combine(
          colorize(),
          timestamp(),
          logFormat
        )
      })
    ];

    if (config.isElasticConfigured) {
      const elasticTransport = new ElasticsearchTransport({
        level: 'info',
        transformer: (logData) => ({
          '@timestamp': new Date().getTime(),
          severity: logData.level,
          message: logData.message,
          service: serviceName,
          fields: logData.meta
        }),
        clientOpts: {
          node: config.elasticUrl,
          maxRetries: 2,
          requestTimeout: 10000,
          sniffOnStart: false
        },
        indexPrefix: `logs-${serviceName.toLowerCase()}-${config.nodeEnv}`
      });

      transportArray.push(elasticTransport);
    }

    this.logger = winston.createLogger({
      level: config.nodeEnv === 'development' ? 'debug' : 'info',
      defaultMeta: { service: serviceName },
      transports: transportArray
    });
  }

  info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  error(message: string, meta?: any): void {
    this.logger.error(message, meta);
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }
}