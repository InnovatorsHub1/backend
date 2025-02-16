import { inject, injectable } from 'inversify';
import { UserRepository } from '@gateway/repositories/user/UserRepository';
import { PasswordService } from './password.service';
import { ApiError } from '@gateway/core/errors/api.error';
import { StatusCodes } from 'http-status-codes';
import { SessionService } from '@gateway/services/auth/session.service';
import { JwtService } from '@gateway/services/jwt/jwt.service';
import { Request } from 'express';
import { StandardValidators } from '@gateway/core/validation/validators';
import { LoginResponse } from '@gateway/services/auth/types';
import { TYPES } from '@gateway/core/di/types';
import { ICredentialsUser, IUser } from '@gateway/repositories/user/IUser';


@injectable()

export class AuthService {

    constructor(
        @inject(TYPES.UserRepository) private userRepository: UserRepository,
        @inject(TYPES.PasswordService) private passwordService: PasswordService,
        @inject(TYPES.SessionService) private sessionService: SessionService,
        @inject(TYPES.JwtService) private jwtService: JwtService
    ) { }

    private async runWithErrorHandling<T>(operation: () => Promise<T | Promise<T>>, errorMessage: string): Promise<T> {
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
        if (!StandardValidators.email(email)) {
            throw new ApiError(
                'Invalid email format',
                StatusCodes.BAD_REQUEST,
                'AuthService'
            );
        }
    }

    async signup(reqBody: Partial<ICredentialsUser>): Promise<ICredentialsUser> {

        this.validateEmail(reqBody.email!);
        const userExists = await this.userRepository.findByEmail(reqBody.email!);
        if (userExists) {
            throw new ApiError('User already exists', StatusCodes.BAD_REQUEST, 'AuthService');
        }
        const hashedPassword = await this.passwordService.hashPassword(reqBody.password!);
        const user = this.userRepository.create({
            email: reqBody.email,
            password: hashedPassword,
            profile: reqBody.profile,
            role: 'user',
            roleExp: reqBody.roleExp || new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
            permissions: reqBody.permissions || ['read'],
            isActive: true,
            isEmailVerified: false,
            lastActiveAt: new Date()
        });
        if (!user) {
            throw new ApiError('Failed to create user', StatusCodes.INTERNAL_SERVER_ERROR, 'AuthService');
        }
        return user as unknown as ICredentialsUser;
    }

    async login(email: string, password: string, deviceInfo: Request['deviceInfo']): Promise<LoginResponse> {
        this.validateEmail(email);
        const user = await this.runWithErrorHandling(
            () => this.userRepository.findByEmail(email.toLowerCase()),
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
                await this.sessionService.createSession(user as IUser, deviceInfo as Request['deviceInfo']);
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
} 