import { injectable, inject } from 'inversify';
import { Application } from 'express';
import { HealthRoutes } from './health.routes';
import { config } from '../config';
import { TYPES } from '../core/di/types';

@injectable()
export class Routes {
    constructor(
        @inject('Application') private readonly app: Application,
        @inject(TYPES.HealthRoutes) private readonly healthRoutes: HealthRoutes
    ) {}

    public initializeRoutes(): void {
        // Add a console.log to debug
        console.log('Initializing routes with base URL:', config.baseUrl);
        this.app.use(`${config.baseUrl}/health`, this.healthRoutes.router);
    }
}
