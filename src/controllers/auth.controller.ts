import { Request, Response, NextFunction, CookieOptions } from 'express';
import { AuthService } from '@gateway/services/auth/auth.service';
import { JwtService } from '@gateway/services/jwt';
import { injectable, inject } from 'inversify';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '@gateway/core/errors/api.error';


@injectable()
export class AuthController {

    private configCookie: CookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict' as const
    };

    constructor(
        @inject('AuthService') private authService: AuthService,
        @inject('JwtService') private jwtService: JwtService

    ) { }

    public async login(req: Request, res: Response, next: NextFunction) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                throw new ApiError('Email and password are required', StatusCodes.UNPROCESSABLE_ENTITY, 'AuthController');
            }

            const deviceInfo = req.deviceInfo;

            const { accessToken, refreshToken } = await this.authService.login(email, password, deviceInfo);

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

            const newAccessToken = await this.jwtService.refreshTokens(refreshToken);

            res.cookie('access_token', newAccessToken, this.configCookie as CookieOptions);

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