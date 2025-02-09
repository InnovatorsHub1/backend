import { inject, injectable } from 'inversify';
import { JwtService } from '@gateway/services/jwt/index';
import { UserRepository } from '@gateway/repositories/user/UserRepository';
import { AccessTokenPayload } from '@gateway/services/jwt/types';
import { ApiError } from '@gateway/core/errors/api.error';
import { StatusCodes } from 'http-status-codes';
import { Request } from 'express';
import { LoginResponse } from '@gateway/services/auth/types';



@injectable()
export class SessionService {
    constructor(
        @inject('JwtService') private jwtService: JwtService,
        @inject('UserRepository') private userRepository: UserRepository
    ) { }

    private async runWithErrorHandling<T>(operation: () => Promise<T>, errorMessage: string): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError(errorMessage, StatusCodes.INTERNAL_SERVER_ERROR, 'SessionService');
        }
    }

    async createSession(userId: string, deviceInfo: Request['deviceInfo']): Promise<LoginResponse> {
        const user = await this.runWithErrorHandling(
            () => this.userRepository.findById(userId),
            'Failed to fetch user'

        );

        if (!user) {
            throw new ApiError('User not found', StatusCodes.NOT_FOUND, 'SessionService');
        }

        await this.userRepository.updateActivity(userId);

        const payload: AccessTokenPayload = {
            permissions: user.permissions,
            sub: userId,
            deviceInfo
        };
        return {
            accessToken: this.jwtService.generateToken(payload),
            refreshToken: await this.jwtService.generateRefreshToken(payload),
            id: user._id!.toString()
        }
    }

    validateSession(token: string): boolean {
        try {
            const payload = this.jwtService.verifyToken(token);
            return payload && typeof payload === 'object' && 'sub' in payload;
        } catch {
            return false;
        }
    }

    async updateActivity(userId: string): Promise<void> {
        await this.runWithErrorHandling(
            () => this.userRepository.updateActivity(userId),
            'Failed to update user activity'
        );
    }
}
