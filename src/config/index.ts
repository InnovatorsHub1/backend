import dotenv from 'dotenv';
import { IConfig } from '../types';
import path = require('path');

dotenv.config();

const getConfig = (): IConfig => ({
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isElasticConfigured: process.env.IS_ELASTIC_CONFIGURED === 'true',
  elasticUrl: process.env.ELASTIC_URL || 'http://localhost:9200',
  appName: process.env.APP_NAME || 'api-gateway',
  baseUrl: process.env.BASE_URL || '',
  logLevel: process.env.LOG_LEVEL || 'info',
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['*'],
  cookieSecret: process.env.COOKIE_SECRET || 'default-secret',
  apiVersion: process.env.API_VERSION || 'v1',
  jwtPublicKeyPath: path.resolve(process.cwd(), process.env.JWT_PUBLIC_KEY_PATH || './keys/public.pem'),
  jwtPrivateKeyPath: path.resolve(process.cwd(), process.env.JWT_PRIVATE_KEY_PATH || './keys/private.pem'),
  jwtRefreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
  jwtAccessExpiration: process.env.JWT_ACCESS_EXPIRATION || '1h',
});

const validateConfig = (config: IConfig): void => {
  const requiredFields: (keyof IConfig)[] = ['port', 'nodeEnv', 'appName'];

  for (const field of requiredFields) {
    if (!config[field]) {
      throw new Error(`Missing required config field: ${field}`);
    }
  }
};

const config = getConfig();
validateConfig(config);

export { config };