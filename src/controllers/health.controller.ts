import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { injectable, inject } from 'inversify';

import { HealthService } from '../services/health.service';
import { WinstonLogger } from '../core/logger/winston.logger';
import { ApiError } from '../core/errors/api.error';
import { TYPES } from '../core/di/types';


@injectable()
export class HealthController {
	private logger = new WinstonLogger('HealthController');


	constructor(
		@inject(TYPES.HealthService) private readonly healthService: HealthService,
	) { }

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