import { Router } from 'express';
import { injectable, inject } from 'inversify';

@injectable()
export class UserRoutes {
  public router: Router;

  constructor() {
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.router.post('/user');

    this.router.get('/users');

    this.router.get('/users:id');

    this.router.put('/users:id');

    this.router.delete('/users:id');
    
    this.router.post('/users:id/restore');
  }
}
