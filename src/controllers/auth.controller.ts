import { Request, Response, NextFunction, CookieOptions } from 'express';
import { AuthService } from '../services/auth/auth.service';
import { JwtService } from '../services/jwt/jwt.service';
import { injectable, inject } from 'inversify';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '@gateway/core/errors/api.error';
import { TYPES } from '@gateway/core/di/types';

@injectable()
export class AuthController {
  private configCookie: CookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const
  };

  constructor(
    @inject(TYPES.AuthService) private authService: AuthService,
    @inject(TYPES.JwtService) private jwtService: JwtService
  ) {}

  public async signup(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, firstName, lastName, phoneNumber } = req.body;

      await this.authService.signup({ email, password, profile: { firstName, lastName, phoneNumber } });
      const { accessToken, refreshToken } = await this.authService.login(email, password, req.deviceInfo);
      res.cookie('access_token', accessToken, this.configCookie as CookieOptions);
      res.cookie('refresh_token', refreshToken, this.configCookie as CookieOptions);

      res.status(StatusCodes.CREATED).json({ message: 'User created successfully' });
    } catch (error) {
      next(error);
    }
  }

  public async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;

      const { accessToken, refreshToken } = await this.authService.login(email, password, req.deviceInfo);

      res.cookie('access_token', accessToken, this.configCookie as CookieOptions);

      res.cookie('refresh_token', refreshToken, this.configCookie as CookieOptions);

      res.status(StatusCodes.OK).json({ message: 'login success' });
    } catch (error) {
      next(error);
    }
  }

  public async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.cookies['refresh_token'];
      if (!refreshToken) {
        res.status(401).json({ message: 'No refresh token provided' });
        return;
      }

      const { accessToken, refreshToken: newRefreshToken } = await this.jwtService.refreshTokens(refreshToken);
      res.cookie('access_token', accessToken, this.configCookie as CookieOptions);
      res.cookie('refresh_token', newRefreshToken, this.configCookie as CookieOptions);

      res.json({ message: 'refresh success' });
    } catch (error) {
      next(error);
    }
  }

  public async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies['refresh_token'];
      if (!refreshToken) {
        throw new ApiError('Unauthorized', StatusCodes.UNAUTHORIZED, 'AuthController');
      }

      await this.jwtService.revokeToken(refreshToken);

      res.clearCookie('access_token');
      res.clearCookie('refresh_token');
      res.status(StatusCodes.OK).json({ message: 'logout success' });
    } catch (error) {
      next(error);
    }
  }
}
