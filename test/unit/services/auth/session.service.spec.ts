import { SessionService } from '@gateway/services/auth/session.service';
import { JwtService } from '@gateway/services/jwt/jwt.service';
import { UserRepository } from '@gateway/repositories/user/UserRepository';
import { ObjectId } from 'mongodb';
import { ApiError } from '@gateway/core/errors/api.error';
import { Request } from 'express';


jest.mock('@gateway/utils/mongoConnection', () => {
    const fakeCollection = {
        createIndex: jest.fn().mockResolvedValue(undefined),
        updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
        deleteMany: jest.fn().mockResolvedValue({}),
        findOne: jest.fn().mockResolvedValue(null),
        aggregate: jest.fn(() => ({ toArray: jest.fn().mockResolvedValue([{ inactiveMinutes: 5 }]) }))
    };

    const fakeDb = {
        collection: jest.fn(() => fakeCollection)
    };

    return {
        mongoConnection: {
            getClient: () => ({
                db: () => fakeDb,
            }),
        },
    };
});

describe('SessionService', () => {
    let sessionService: SessionService;
    let jwtService: jest.Mocked<JwtService>;
    let userRepository: UserRepository;

    beforeEach(() => {
        jwtService = {
            verifyToken: jest.fn()
        } as any;

        userRepository = new UserRepository();
        (userRepository as any).collection = { updateOne: jest.fn() };

        sessionService = new SessionService(jwtService, userRepository);
        jest.spyOn((userRepository as any).collection, 'updateOne').mockResolvedValue({ modifiedCount: 1 } as any);

    });

    describe('createSession', () => {
        it('should call updateActivity with the user id', async () => {
            const user = { _id: new ObjectId("507f1f77bcf86cd799439011") } as any;
            const deviceInfo: Request['deviceInfo'] = { userAgent: 'Mozilla/5.0', ip: '127.0.0.1' };

            const updateActivitySpy = jest
                .spyOn(userRepository, 'updateActivity')
                .mockResolvedValue(undefined);

            await sessionService.createSession(user, deviceInfo);

            expect(updateActivitySpy).toHaveBeenCalled();
            expect(updateActivitySpy.mock.calls[0][0]).toBe(user._id.toString());
        });

        it('should throw an ApiError if updateActivity fails', async () => {
            const user = { _id: new ObjectId("507f1f77bcf86cd799439011") } as any;
            const deviceInfo: Request['deviceInfo'] = { userAgent: 'Mozilla/5.0', ip: '127.0.0.1' };

            jest.spyOn((userRepository as any).collection, 'updateOne').mockResolvedValue({ modifiedCount: 0 } as any);

            await expect(sessionService.createSession(user, deviceInfo)).rejects.toThrow(ApiError);
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
}); 