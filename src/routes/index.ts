import { injectable, inject } from 'inversify';
import { Application } from 'express';
import { HealthRoutes } from './health.routes';
import { QueueRoutes } from './queue.routes';
import { PDFRoutes } from './pdf.routes';
import { config } from '../config';
import { TYPES } from '../core/di/types';
import { AuthRoutes } from './auth.routes';
@injectable()
export class Routes {
    constructor(
        @inject('Application') private readonly app: Application,
        @inject(TYPES.HealthRoutes) private readonly healthRoutes: HealthRoutes,
        @inject(TYPES.PDFRoutes) private readonly pdfRoutes: PDFRoutes,
        @inject(TYPES.QueueRoutes) private readonly queueRoutes: QueueRoutes,
        @inject(TYPES.AuthRoutes) private readonly authRoutes: AuthRoutes
    ) { }

    public initializeRoutes(): void {
        console.log('Initializing routes with base URL:', config.baseUrl);
        this.app.use(`${config.baseUrl}/health`, this.healthRoutes.router);
        this.app.use(`${config.baseUrl}/pdf`, this.pdfRoutes.router);
        this.app.use(`${config.baseUrl}/queue`, this.queueRoutes.router);
        this.app.use(`${config.baseUrl}/auth`, this.authRoutes.router);
    }
}
