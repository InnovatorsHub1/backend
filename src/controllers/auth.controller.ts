import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { injectable, inject } from 'inversify';
// import { GoogleUser } from '@gateway/services/auth/auth.types';

import { TYPES } from '../core/di/types';
import { AuthService } from '../services/auth/auth.service';
import { WinstonLogger } from '../core/logger/winston.logger';
import { ApiError } from '../core/errors/api.error';

// TODO - part 2 here you extend the request but it failed on part 1


@injectable()
export class AuthController {
  private logger = new WinstonLogger('AuthController');

  constructor(@inject(TYPES.AuthService) private readonly authService: AuthService) { }
  googleGenerateAuthUrl = async (_req: Request, res: Response): Promise<void> => {
    try {
      const authUrl = await this.authService.generateAuthUrl();
      res.status(StatusCodes.OK).json({ url: authUrl });
    } catch (error) {
      this.logger.error('Failed to generate auth URL', error);
      throw new ApiError('Failed to generate auth URL', StatusCodes.INTERNAL_SERVER_ERROR, 'AuthController');
    }
  };

  getUserDataByAccessToken = async (req: Request, res: Response): Promise<void> => {
    const { accessToken } = req.params;
    try {
      const userData = await this.authService.getUserData(accessToken);
      res.status(StatusCodes.OK).json({ user: userData });
    } catch (error) {
      this.logger.error('Failed to get user data', error);
      throw new ApiError('Failed to get user data', StatusCodes.INTERNAL_SERVER_ERROR, 'AuthController');
    }
  };

  googleCallback = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        throw new ApiError('No user data received', StatusCodes.UNAUTHORIZED, 'AuthController');
      }
      res.status(StatusCodes.OK).json({ user: req.user });
    } catch (error) {
      this.logger.error('Google callback failed', error);
      throw new ApiError('Google callback failed', StatusCodes.INTERNAL_SERVER_ERROR, 'AuthController');
    }
  };
}