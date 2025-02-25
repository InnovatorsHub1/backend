import { Router } from 'express';
import { injectable, inject } from 'inversify';
import { TYPES } from '../core/di/types';

@injectable()
export class RoleRoutes {
  public router: Router;

  constructor(@inject(TYPES.RoleController) private readonly controller: RoleController) {
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {


    this.router.post('/role', this.controller.createRole.bind(this.controller));

  }
}
