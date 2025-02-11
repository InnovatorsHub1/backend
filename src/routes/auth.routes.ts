import { Router } from 'express';
import { injectable, inject } from 'inversify';
import passport from 'passport';
import { createValidator } from '@gateway/middleware/validate-request.middleware';

import { TYPES } from '../core/di/types';
import { AuthController, RequestWithUser } from '../controllers/auth.controller';

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

    this.router.post('/google', googleCheckValidator, (req, res) =>
      this.controller.googleGenerateAuthUrl(req as RequestWithUser, res),
    );

    this.router.get('/google/callback',
      passport.authenticate('google', { failureRedirect: '/login' }),
      (req, res) => this.controller.googleCallback(req as RequestWithUser, res),
    );

    this.router.get('/google/user-data/:accessToken', googleCheckValidator,
      (req, res) => this.controller.getUserDataByAccessToken(req as RequestWithUser, res),
    );
  }
}
