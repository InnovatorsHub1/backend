import { Application } from 'express';
import { HealthRoutes } from './health.routes'; 
import { config } from '../config';

export class Routes {
  private healthRoutes: HealthRoutes; 

  constructor(private app: Application) {
    this.healthRoutes = new HealthRoutes(); 
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.app.use(`${config.baseUrl}/health`, this.healthRoutes.router);
  }
}