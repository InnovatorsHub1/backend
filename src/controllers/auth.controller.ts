import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { injectable, inject } from 'inversify';
import { TYPES } from '../core/di/types';
import { AuthService } from '../services/auth.service';
import { WinstonLogger } from '../core/logger/winston.logger';
import { GoogleUser, AuthResponse } from '../types/auth.types';
import { ApiError } from '../core/errors/api.error';

interface RequestWithUser extends Request {
    user?: GoogleUser;
}

@injectable()
export class AuthController {
    private logger = new WinstonLogger('AuthController');

    constructor(
        @inject(TYPES.AuthService) private readonly authService: AuthService
    ) {}

    googleCallback = async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            if (req.user) {
                const user = await this.authService.validateOrCreateUser(req.user);
                req.session.user = user;

                const response: AuthResponse = {
                    success: true,
                    data: {
                        user,
                        redirectUrl: '/dashboard'
                    }
                };

                res.status(StatusCodes.OK).json(response);
            } else {
                throw new ApiError('Authentication failed', StatusCodes.UNAUTHORIZED, 'AuthController');
            }
        } catch (error) {
            this.logger.error('Google callback failed', error);
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                success: false,
                error: 'Authentication failed'
            });
        }
    };

    logout = async (req: RequestWithUser, res: Response): Promise<void> => {
        try {
            if (req.user?.googleId) {
                await this.authService.isUserAuthenticated(req.user.googleId);
            }

            req.session.destroy((err) => {
                if (err) {
                    throw new ApiError('Logout failed', 500, 'AuthController');
                }
                res.status(StatusCodes.OK).json({
                    success: true,
                    message: 'Logged out successfully'
                });
            });
        } catch (error) {
            this.logger.error('Logout failed', error);
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                success: false,
                error: 'Logout failed'
            });
        }
    };
}