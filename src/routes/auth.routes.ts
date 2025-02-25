import { Router } from 'express';
import { AuthController } from '@gateway/controllers/auth.controller';
import { createValidator } from '@gateway/middleware/validate-request.middleware';
import { injectable, inject } from 'inversify';
import { TYPES } from '../core/di/types';

@injectable()
export class AuthRoutes {
  public router: Router;

  constructor(@inject(TYPES.AuthController) private readonly controller: AuthController) {
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    const loginValidator = createValidator({
      body: ['email', 'password'],
    });

    const signupValidator = createValidator({
      body: ['email', 'password'],
    });

    this.router.post('/signup', signupValidator, this.controller.signup.bind(this.controller));

    this.router.post('/login', loginValidator, this.controller.login.bind(this.controller));

    this.router.post('/refresh', this.controller.refresh.bind(this.controller));

    this.router.post('/logout', this.controller.logout.bind(this.controller));
  }
}
