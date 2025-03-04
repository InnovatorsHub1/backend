import { ILogger } from '@gateway/types';

import { MaskableData } from './logger.interfaces';
import { WinstonLogger } from './winston.logger';

/**
 * Extended Winston Logger with enhanced features.
 */
export class ExtendedWinstonLogger extends WinstonLogger {
  constructor(serviceName: string) {
    super(serviceName);
    
  }

  /**
   * Masks sensitive data in logging metadata
   * @param {MaskableData} data - Data to be masked
   * @returns {MaskableData} Masked data object
   * @private
   */
  private maskSensitiveData(data: MaskableData): MaskableData {
    const sensitiveFields = ['userId', 'ipAddress', 'correlationId', 'requestId'];

    const maskedData: MaskableData = { ...data };

    for (const key in maskedData) {
      if (sensitiveFields.includes(key)) {
        maskedData[key] = '***MASKED***';
      } else if (typeof maskedData[key] === 'object' && maskedData[key] !== null) {
        maskedData[key] = this.maskSensitiveData(maskedData[key] as MaskableData);
      }
    }

    return maskedData;
  }

  /**
   * Creates a child logger with parent context
   * @param {string} name - Name for the child logger
   * @returns {ILogger} New logger instance with parent prefix
   */
  createChildLogger(name: string): ILogger {
    return new ExtendedWinstonLogger(`${this.service}:${name}`);
  }

  /**
   * Changes the active logging level dynamically.
   * @param {string} level - New log level to set
   */
  setLogLevel(level: string): void {
    this.logger.level = level;
  }

  /**
   * Logs info level message with optional masked metadata.
   * @param {string} message - Log message
   * @param {MaskableData} [meta] - Optional metadata
   */
  info(message: string, meta?: MaskableData): void {
    const maskedMeta = meta ? this.maskSensitiveData(meta) : undefined;
    this.logger.info(message, maskedMeta);
  }

  /**
   * Logs an error with structured error data.
   * @param {string} message - Error message
   * @param {Error | unknown} [error] - Optional error object
   * @param {MaskableData} [meta] - Optional metadata
   */
  error(message: string, error?: Error | unknown, meta?: MaskableData): void {
    const maskedMeta = meta ? this.maskSensitiveData(meta) : undefined;
    this.logger.error(message, {
      ...maskedMeta,
      error: error instanceof Error ?
        {
          name: error.name,
          message: error.message,
          stack: error.stack,
        } :
        error ?
          { message: error.toString() } :
          undefined,
    });
  }

  /**
   * Logs a warning with optional masked metadata.
   * @param {string} message - Warning message
   * @param {MaskableData} [meta] - Optional metadata
   */
  warn(message: string, meta?: MaskableData): void {
    const maskedMeta = meta ? this.maskSensitiveData(meta) : undefined;
    this.logger.warn(message, maskedMeta);
  }

  /**
   * Logs debug level message with optional masked metadata.
   * @param {string} message - Debug message
   * @param {MaskableData} [meta] - Optional metadata
   */
  debug(message: string, meta?: MaskableData): void {
    const maskedMeta = meta ? this.maskSensitiveData(meta) : undefined;
    this.logger.debug(message, maskedMeta);
  }
}


// import winston, { Logger, format, transports } from 'winston';
// import { ElasticsearchTransport } from 'winston-elasticsearch';

// import { ILogger } from '../../types';
// import { config } from '../../config';

// import { MaskableData } from './logger.interfaces';

// /**
//  * WinstonLogger provides a robust logging implementation with multiple transports
//  * @implements {ILogger}
//  */
// export class WinstonLogger implements ILogger {
//   private logger: Logger;
//   private service: string;

//   /**
//    * Creates a new WinstonLogger instance
//    * @param {string} serviceName - Name of the service for log identification
//    */
//   constructor(serviceName: string) {
//     this.service = serviceName;
//     const { combine, timestamp, colorize, printf } = format;

//     const logFormat = printf(({ level, message, timestamp: logTimestamp, ...meta }) => {
//       return `${logTimestamp} [${serviceName}] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
//     });

//     const transportArray: winston.transport[] = [
//       new transports.Console({
//         format: combine(colorize(), timestamp(), logFormat),
//       }),
//     ];

//     if (config.isElasticConfigured) {
//       const elasticTransport = new ElasticsearchTransport({
//         level: 'info',
//         transformer: (logData) => ({
//           '@timestamp': new Date().getTime(),
//           severity: logData.level,
//           message: logData.message,
//           service: serviceName,
//           fields: logData.meta,
//         }),
//         clientOpts: {
//           node: config.elasticUrl,
//           maxRetries: 2,
//           requestTimeout: 10000,
//           sniffOnStart: false,
//         },
//         indexPrefix: `logs-${serviceName.toLowerCase()}-${config.nodeEnv}`,
//       });

//       transportArray.push(elasticTransport);
//     }

//     this.logger = winston.createLogger({
//       level: config.nodeEnv === 'development' ? 'debug' : 'info',
//       defaultMeta: { service: serviceName },
//       transports: transportArray,
//     });
//   }

//   /**
//    * Masks sensitive data in logging metadata
//    * @param {MaskableData} data - Data to be masked
//    * @returns {MaskableData} Masked data object
//    * @private
//    */
//   private maskSensitiveData(data: MaskableData): MaskableData {
//     const sensitiveFields = [
//       'userId',
//       'ipAddress',
//       'correlationId',
//       'requestId',
//     ];

//     if (typeof data === 'object' && data !== null) {
//       const maskedData = { ...data };
//       Object.keys(maskedData).forEach((key) => {
//         const value = maskedData[key];
//         if (sensitiveFields.includes(key.toLowerCase())) {
//           maskedData[key] = '***MASKED***';
//         } else if (typeof value === 'object') {
//           maskedData[key] = this.maskSensitiveData(value as MaskableData);
//         }
//       });

//       return maskedData;
//     }

//     return data;
//   }

//   /**
//    * Creates a child logger with parent context
//    * @param {string} name - Name for the child logger
//    * @returns {ILogger} New logger instance with parent prefix
//    */
//   createChildLogger(name: string): ILogger {
//     return new WinstonLogger(`${this.service}:${name}`);
//   }

//   /**
//    * Changes the active logging level
//    * @param {string} level - New log level to set
//    */
//   setLogLevel(level: string): void {
//     this.logger.level = level;
//   }

//   /**
//    * Logs info level message
//    * @param {string} message - Log message
//    * @param {MaskableData} [meta] - Optional metadata
//    */
//   info(message: string, meta?: MaskableData): void {
//     const maskedMeta = meta ? this.maskSensitiveData(meta) : undefined;
//     this.logger.info(message, maskedMeta);
//   }

//   /**
//    * Logs error level message
//    * @param {string} message - Error message
//    * @param {Error} [error] - Error object
//    * @param {MaskableData} [meta] - Optional metadata
//    */
//   error(message: string, error?: Error | unknown, meta?: MaskableData): void {
//     const maskedMeta = meta ? this.maskSensitiveData(meta) : undefined;
//     this.logger.error(message, {
//       ...maskedMeta,
//       error: error instanceof Error ?
//         {
//           name: error.name,
//           message: error.message,
//           stack: error.stack,
//         } :
//         error ?
//           {
//             message: error.toString(),
//           } :
//           undefined,
//     });
//   }

//   /**
//    * Logs warning level message
//    * @param {string} message - Warning message
//    * @param {MaskableData} [meta] - Optional metadata
//    */
//   warn(message: string, meta?: MaskableData): void {
//     const maskedMeta = meta ? this.maskSensitiveData(meta) : undefined;
//     this.logger.warn(message, maskedMeta);
//   }

//   /**
//    * Logs debug level message
//    * @param {string} message - Debug message
//    * @param {MaskableData} [meta] - Optional metadata
//    */
//   debug(message: string, meta?: MaskableData): void {
//     const maskedMeta = meta ? this.maskSensitiveData(meta) : undefined;
//     this.logger.debug(message, maskedMeta);
//   }
// }