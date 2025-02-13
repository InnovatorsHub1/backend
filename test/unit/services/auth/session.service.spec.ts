import { SessionService } from '@gateway/services/auth/session.service';
import { JwtService } from '@gateway/services/jwt/jwt.service';
import { UserRepository } from '@gateway/repositories/user/UserRepository';
import { ObjectId } from 'mongodb';
import { ApiError } from '@gateway/core/errors/api.error';
import { Request } from 'express';
import { StatusCodes } from 'http-status-codes';

describe('SessionService', () => {
    let sessionService: SessionService;
    let jwtService: jest.Mocked<JwtService>;
    let userRepository: jest.Mocked<UserRepository>;

    beforeEach(() => {
        jwtService = {
            verifyToken: jest.fn()
        } as any;

        userRepository = {
            updateActivity: jest.fn()
        } as any;

        sessionService = new SessionService(jwtService, userRepository);
    });

    describe('createSession', () => {
        it('should call updateActivity with the user id', async () => {
            const user = { _id: new ObjectId() } as any;
            const deviceInfo: Request['deviceInfo'] = { userAgent: 'Mozilla/5.0', ip: '127.0.0.1' };

            await sessionService.createSession(user, deviceInfo);

            expect(userRepository.updateActivity).toHaveBeenCalledWith(user._id.toString());
        });

        it('should throw an ApiError if updateActivity fails', async () => {
            const user = { _id: new ObjectId() } as any;
            const deviceInfo: Request['deviceInfo'] = { userAgent: 'Mozilla/5.0', ip: '127.0.0.1' };
            userRepository.updateActivity.mockRejectedValue(new ApiError('update failed', StatusCodes.INTERNAL_SERVER_ERROR, 'SessionService'));

            await expect(sessionService.createSession(user, deviceInfo))
                .rejects.toThrow(ApiError);
        });
    });

    describe('validateSession', () => {
        it('should return true if verifyToken returns a valid payload', () => {
            jwtService.verifyToken.mockReturnValue({ sub: 'user123' });
            const result = sessionService.validateSession('valid-token');
            expect(result).toBe(true);
        });

        it('should return false if verifyToken throws an error', () => {
            jwtService.verifyToken.mockImplementation(() => { throw new Error('invalid token'); });
            const result = sessionService.validateSession('invalid-token');
            expect(result).toBe(false);
        });

        it('should return false if verifyToken returns an invalid payload', () => {
            jwtService.verifyToken.mockReturnValue({});
            const result = sessionService.validateSession('token-without-sub');
            expect(result).toBe(false);
        });
    });

    describe('updateActivity', () => {
        it('should call updateActivity on the userRepository with the provided userId', async () => {
            const userId = 'user123';
            await sessionService.updateActivity(userId);
            expect(userRepository.updateActivity).toHaveBeenCalledWith(userId);
        });

        it('should throw an ApiError if updateActivity fails', async () => {
            const userId = 'user123';
            userRepository.updateActivity.mockRejectedValue(new Error('failed'));
            await expect(sessionService.updateActivity(userId)).rejects.toThrow(ApiError);
        });
    });

    describe('runWithErrorHandling', () => {
        it('should throw ApiError', async () => {
            await expect((sessionService as any).runWithErrorHandling(() => Promise.reject(new ApiError('test error', StatusCodes.BAD_REQUEST, 'SessionService'))))
                .rejects
                .toThrow(ApiError);
        });
    });
}); 