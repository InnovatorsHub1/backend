import { inject, injectable } from 'inversify';
import { JwtService } from '@gateway/services/jwt/jwt.service';
import { UserRepository } from '@gateway/repositories/user/UserRepository';
import { ApiError } from '@gateway/core/errors/api.error';
import { StatusCodes } from 'http-status-codes';
import { Request } from 'express';
import { TYPES } from '@gateway/core/di/types';
import { IUser } from '@gateway/repositories/user/IUser';


@injectable()

export class SessionService {
    constructor(
        @inject(TYPES.JwtService) private jwtService: JwtService,
        @inject(TYPES.UserRepository) private userRepository: UserRepository
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

    async createSession(user: IUser, deviceInfo: Request['deviceInfo']): Promise<void> {
        await this.userRepository.updateActivity(user._id!.toString());
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
