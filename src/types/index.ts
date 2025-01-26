export interface IErrorResponse {
    message: string;
    statusCode: number;
    status: string;
    source: string;
    timestamp: string;
  }
  
  export interface ILogger {
    info(message: string, meta?: any): void;
    error(message: string, meta?: any): void;
    warn(message: string, meta?: any): void;
    debug(message: string, meta?: any): void;
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
  }

