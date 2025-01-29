import { injectable, inject } from 'inversify';
import { Application } from 'express';
import { HealthRoutes } from './health.routes';
import { PDFRoutes } from './pdf.routes';
import { config } from '../config';
import { TYPES } from '../core/di/types';

@injectable()
export class Routes {
    constructor(
        @inject('Application') private readonly app: Application,
        @inject(TYPES.HealthRoutes) private readonly healthRoutes: HealthRoutes,
        @inject(TYPES.PDFRoutes) private readonly pdfRoutes: PDFRoutes
    ) {}

    public initializeRoutes(): void {
        console.log('Initializing routes with base URL:', config.baseUrl);
        this.app.use(`${config.baseUrl}/health`, this.healthRoutes.router);
        this.app.use(`${config.baseUrl}/pdf`, this.pdfRoutes.router);
    }
}
