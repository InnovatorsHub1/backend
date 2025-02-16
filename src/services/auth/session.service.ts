import { inject, injectable } from 'inversify';
import { JwtService } from '@gateway/services/jwt/jwt.service';
import { UserRepository } from '@gateway/repositories/user/UserRepository';
import { ApiError } from '@gateway/core/errors/api.error';
import { StatusCodes } from 'http-status-codes';
import { TYPES } from '@gateway/core/di/types';
import { IUser } from '@gateway/repositories/user/IUser';
import { Request } from 'express';

@injectable()

export class SessionService {
    constructor(
        @inject(TYPES.JwtService) private jwtService: JwtService,
        @inject(TYPES.UserRepository) private userRepository: UserRepository
    ) { }

    async createSession(user: IUser, deviceInfo: Request['deviceInfo']): Promise<void> {
        try {
            await this.userRepository.updateActivity(user._id!.toString(), deviceInfo)
            await this.userRepository.updateLastLogin(user._id!.toString(), deviceInfo)
        } catch (error) {
            throw new ApiError('Failed to update user activity', StatusCodes.INTERNAL_SERVER_ERROR, 'SessionService');
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
}
