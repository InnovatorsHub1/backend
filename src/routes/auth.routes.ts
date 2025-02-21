import { Router } from 'express';
import { injectable, inject } from 'inversify';
import passport from 'passport';
import { createValidator } from '@gateway/middleware/validate-request.middleware';

import { TYPES } from '../core/di/types';
import { AuthController } from '../controllers/auth.controller';

@injectable()
export class AuthRoutes {
  public router: Router;

  constructor(@inject(TYPES.AuthController) private readonly controller: AuthController) {
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    const googleCheckValidator = createValidator({
      headers: ['x-api-key'],
      query: ['version'],
    });

    // TODO - 1: what I need to here ??
    this.router.post('/google', this.controller.googleGenerateAuthUrl.bind(this.controller),
    );

    this.router.get('/google/callback',
      passport.authenticate('google', { failureRedirect: '/login' }),
      this.controller.googleCallback.bind(this.controller),
    );

    this.router.get('/google/user-data/:accessToken',
      googleCheckValidator,
      this.controller.getUserDataByAccessToken.bind(this.controller),
    );
  }
}