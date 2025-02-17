import { SessionService } from '@gateway/services/auth/session.service';
import { JwtService } from '@gateway/services/jwt/jwt.service';
import { UserRepository } from '@gateway/repositories/user/UserRepository';
import { ObjectId } from 'mongodb';
import { ApiError } from '@gateway/core/errors/api.error';
import { Request } from 'express';


jest.mock('@gateway/utils/mongoConnection', () => ({
    getMongoConnection: jest.fn().mockReturnValue({
        connect: jest.fn().mockResolvedValue(undefined),
        getClient: jest.fn().mockReturnValue({
            db: jest.fn().mockReturnValue({
                collection: jest.fn().mockReturnValue({
                    createIndex: jest.fn().mockResolvedValue('index created'),
                    findOne: jest.fn().mockResolvedValue(null),
                    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 } as any),
                    insertOne: jest.fn().mockResolvedValue({ acknowledged: true }),
                    deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
                    countDocuments: jest.fn().mockResolvedValue(0)
                })
            })
        })
    })
}));


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