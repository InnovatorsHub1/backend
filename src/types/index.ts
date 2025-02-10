import { LogMeta } from '@gateway/core/logger/logger.interfaces';

export interface IErrorResponse {
  message: string;
  statusCode: number;
  status: string;
  source: string;
  timestamp: string;
}

export interface ILogger {
  info(message: string, meta?: LogMeta): void;
  error(message: string, meta?: LogMeta): void;
  warn(message: string, meta?: LogMeta): void;
  debug(message: string, meta?: LogMeta): void;
}

export interface IConfig {
  port: number;
  nodeEnv: string;
  isElasticConfigured: boolean;
  elasticUrl: string;
  appName: string;
  baseUrl: string;
  logLevel: string;
  corsOrigins: string[];
  cookieSecret: string;
  apiVersion: string;
  jwtPublicKeyPath: string | undefined;
  jwtPrivateKeyPath: string | undefined;
  jwtAccessExpiration: string | number;
  jwtRefreshExpiration: string | number;
}

