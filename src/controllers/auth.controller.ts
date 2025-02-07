import { Request, Response, NextFunction } from 'express';
import { AuthService } from '@gateway/services/auth/auth.service';
import { JwtService } from '@gateway/services/jwt';
import { extractDeviceInfo } from '@gateway/utils/device';
import { injectable, inject } from 'inversify';
import { StatusCodes } from 'http-status-codes';
import { DeviceInfo } from '@gateway/services/auth/types';
import { ApiError } from '@gateway/core/errors/api.error';


@injectable()
export class AuthController {
    constructor(
        @inject('AuthService') private authService: AuthService,
        @inject('JwtService') private jwtService: JwtService
    ) { }

    public async login(req: Request, res: Response, next: NextFunction) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                throw new ApiError('Email and password are required', StatusCodes.BAD_REQUEST, 'AuthController');
            }

            const rawDeviceInfo = extractDeviceInfo(req);
            const deviceInfo: DeviceInfo = {
                userAgent: rawDeviceInfo.userAgent || 'Unknown',
                ip: rawDeviceInfo.ip || req.ip || 'Unknown',
                platform: rawDeviceInfo.platform
            };

            const { accessToken, refreshToken } = await this.authService.login(email, password, deviceInfo);

            res.cookie('access_token', accessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict'
            });

            res.cookie('refresh_token', refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict'
            });

            res.status(StatusCodes.OK).json({ success: true });
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

            const newAccessToken = await this.jwtService.refreshTokens(refreshToken);

            res.cookie('access_token', newAccessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict'
            });

            res.json({ success: true });
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
            res.status(StatusCodes.OK).json({ success: true });
        } catch (error) {
            next(error);
        }
    }
} 