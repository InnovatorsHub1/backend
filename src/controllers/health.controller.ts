import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { HealthService } from '../services/health.service';
import { WinstonLogger } from '../core/logger/winston.logger';
import { ApiError } from '../core/errors/api.error';

export class HealthController {
  private logger = new WinstonLogger('HealthController');
  private healthService: HealthService;

  constructor() {
    this.healthService = new HealthService();
  }

  async check(req: Request, res: Response): Promise<void> {
    try {
      const healthCheck = await this.healthService.checkHealth();
      res.status(StatusCodes.OK).json(healthCheck);
    } catch (error) {
      this.logger.error('Health check failed', error);
      throw new ApiError('Health check failed', StatusCodes.INTERNAL_SERVER_ERROR, 'HealthController');
    }
  }
}