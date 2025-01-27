import { WinstonLogger } from '../core/logger/winston.logger';
import { injectable } from 'inversify';

export interface IHealthCheck {
  status: string;
  uptime: number;
  timestamp: string;
  version: string;
  memory: {
    used: number;
    total: number;
    rss: number;
  };
 }
 

 @injectable()
 export class HealthService {
  private logger = new WinstonLogger('HealthService');
 
  async checkHealth(): Promise<IHealthCheck> {
    this.logger.info('Performing health check');
    
    const memory = process.memoryUsage();
    
    return {
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      memory: {
        used: memory.heapUsed,
        total: memory.heapTotal,
        rss: memory.rss
      }
    };
  }
 }