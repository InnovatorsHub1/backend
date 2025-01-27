import { Router } from 'express';
import { HealthController } from '@gateway/controllers/health.controller';
import { createValidator } from '@gateway/middleware/validate-request.middleware';
import { injectable, inject } from 'inversify';
import { TYPES } from '../core/di/types';


@injectable()
export class HealthRoutes {
  public router: Router;


  constructor(
    @inject(TYPES.HealthController) private readonly controller: HealthController
  ) {
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    const healthCheckValidator = createValidator({
      headers: ['x-api-key'],
      query: ['version']
    });

    this.router.get(
      '/',
      healthCheckValidator,
      this.controller.check.bind(this.controller)
    );
  }
}