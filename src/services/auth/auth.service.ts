import { inject, injectable } from 'inversify';
import { UserRepository } from '@gateway/repositories/user/UserRepository';
import { PasswordService } from './password.service';
import { ApiError } from '@gateway/core/errors/api.error';
import { StatusCodes } from 'http-status-codes';
import { SessionService } from '@gateway/services/auth/session.service';
import { JwtService } from '@gateway/services/jwt/index';
import { DeviceInfo, LoginResponse } from './types';

@injectable()

export class AuthService {
    private readonly EMAIL_REGEX = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;

    constructor(
        @inject('UserRepository') private userRepository: UserRepository,
        @inject('PasswordService') private passwordService: PasswordService,
        @inject('SessionService') private sessionService: SessionService,
        @inject('JwtService') private jwtService: JwtService
    ) { }

    private async runWithErrorHandling<T>(operation: () => Promise<T>, errorMessage: string): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError(errorMessage, StatusCodes.INTERNAL_SERVER_ERROR, 'AuthService');
        }
    }

    private validateEmail(email: string): void {
        if (!this.EMAIL_REGEX.test(email)) {
            throw new ApiError(
                'Invalid email format',
                StatusCodes.BAD_REQUEST,
                'AuthService'
            );
        }
    }

    async login(email: string, password: string, deviceInfo?: DeviceInfo): Promise<LoginResponse> {
        this.validateEmail(email);


        const user = await this.runWithErrorHandling(
            () => this.userRepository.findByEmail(email),
            'Failed to fetch user'
        );

        if (!user) {
            throw new ApiError('Invalid credentials', StatusCodes.UNAUTHORIZED, 'AuthService');
        }

        if (user.lockUntil && user.lockUntil > new Date()) {
            throw new ApiError('Account is locked', StatusCodes.UNAUTHORIZED, 'AuthService');
        }

        const isPasswordValid = await this.passwordService.comparePassword(password, user.password);

        if (!isPasswordValid) {
            await this.runWithErrorHandling(
                () => this.handleFailedLogin(user._id!.toString()),
                'Failed to update login attempts'
            );
            throw new ApiError('Invalid credentials', StatusCodes.UNAUTHORIZED, 'AuthService');
        }

        await this.runWithErrorHandling(
            async () => {
                await this.handleSuccessfulLogin(user._id!.toString());
                await this.sessionService.createSession(user._id!.toString(), deviceInfo as DeviceInfo);
            },
            'Failed to complete login process'

        );

        const accessToken = this.jwtService.generateToken({
            sub: user._id!.toString(),
            permissions: user.permissions
        });

        const refreshToken = await this.jwtService.generateRefreshToken({
            sub: user._id!.toString(),
            permissions: user.permissions
        });

        this.userRepository.updateLastLogin(user._id!.toString())

        return { accessToken, refreshToken, id: user._id!.toString() };
    }

    private async handleFailedLogin(userId: string): Promise<void> {
        await this.userRepository.incrementFailedAttempts(userId);
    }

    private async handleSuccessfulLogin(userId: string): Promise<void> {
        await this.userRepository.resetFailedAttempts(userId);
        await this.userRepository.updateLastLogin(userId);
    }

    async logout(userId: string): Promise<void> {
        await this.jwtService.revokeToken(userId);
    }
} 