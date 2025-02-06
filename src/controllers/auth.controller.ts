import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { injectable, inject } from 'inversify';

import { TYPES } from '../core/di/types';
import { AuthService } from '../services/auth.service';
import { WinstonLogger } from '../core/logger/winston.logger';
import { GoogleUser } from '../types/auth.types';
import { ApiError } from '../core/errors/api.error';

interface RequestWithUser extends Request {
  user?: GoogleUser;
}

@injectable()
export class AuthController {
  private logger = new WinstonLogger('AuthController');

  constructor(@inject(TYPES.AuthService) private readonly authService: AuthService) { }
  googleGenerateAuthUrl = async (_req: RequestWithUser, res: Response): Promise<void> => {
    try {
      const authUrl = await this.authService.generateAuthUrl();
      res.status(StatusCodes.CREATED).json(authUrl);
    } catch (error) {
      this.logger.error('Health check failed', error);
      throw new ApiError('Health check failed', StatusCodes.INTERNAL_SERVER_ERROR, 'HealthController');
    }
  };

  getUserDataByAccessToken = async (req: RequestWithUser, res: Response): Promise<void> => {
    const { accessToken } = req.params;
    try {
      const userData = await this.authService.getUserData(accessToken);
      res.status(StatusCodes.OK).json(userData);
    } catch (error) {
      this.logger.error('Health check failed', error);
      throw new ApiError('Health check failed', StatusCodes.INTERNAL_SERVER_ERROR, 'HealthController');
    }
  };
}
