import { Router } from 'express';
import passport from 'passport';
import { injectable, inject } from 'inversify';
import { TYPES } from '../core/di/types';
import { AuthController } from '../controllers/auth.controller';

@injectable()
export class AuthRoutes {
    public router: Router;

    constructor(
        @inject(TYPES.AuthController) private readonly controller: AuthController
    ) {
        this.router = Router();
        this.setupRoutes();
    }

    private setupRoutes(): void {
        // Google OAuth routes
        this.router.get(
            '/google',
            passport.authenticate('google', { 
                scope: ['profile', 'email'],
                session: true 
            })
        );

        this.router.get(
            '/google/callback',
            passport.authenticate('google', { 
                failureRedirect: `${process.env.FRONTEND_URL}/login`,
                session: true
            }),
            this.controller.googleCallback
        );

        this.router.get('/logout', this.controller.logout);
    }
}