import { UserRepository } from '@gateway/repositories/user/UserRepository';
import { IUser } from '@gateway/repositories/user/IUser';
import { Collection, ObjectId } from 'mongodb';
import { mongoConnection } from '@gateway/utils/mongoConnection';
import { ApiError } from '@gateway/core/errors/api.error';
import { StatusCodes } from 'http-status-codes';
import { Request } from 'express';
jest.mock('@gateway/utils/mongoConnection', () => ({
    mongoConnection: {
        getClient: jest.fn().mockReturnValue({
            db: jest.fn().mockReturnValue({
                collection: jest.fn().mockReturnValue({
                    findOne: jest.fn(),
                    updateOne: jest.fn(),
                    find: jest.fn(),
                    deleteMany: jest.fn(),
                    createIndex: jest.fn()
                })
            })
        })
    },
}));

describe('UserRepository', () => {
    let userRepository: UserRepository;
    let mockCollection: jest.Mocked<Collection<IUser>>;

    beforeEach(() => {
        mockCollection = {
            findOne: jest.fn(),
            updateOne: jest.fn(),
            createIndex: jest.fn(),
            deleteMany: jest.fn(),
            aggregate: jest.fn().mockReturnValue({ toArray: jest.fn() })
        } as any;

        jest.spyOn(mongoConnection, 'getClient').mockReturnValue({
            db: () => ({
                collection: () => mockCollection
            })
        } as any);

        userRepository = new UserRepository();
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    describe('findByEmail', () => {
        it('should find user by email', async () => {
            const mockUser = { email: 'test@example.com', username: 'test' };
            jest.spyOn((userRepository as any).collection, 'findOne').mockResolvedValue(mockUser);

            const result = await userRepository.findByEmail('test@example.com');
            expect(result).toEqual(mockUser);
        });
    });

    it('should return null when user not found by email', async () => {
        jest.spyOn((userRepository as any).collection, 'findOne').mockResolvedValue(null);
        const result = await userRepository.findByEmail('notfound@example.com');
        expect(result).toBeNull();
    });

    it('should increment failed attempts when user is found', async () => {
        const userId = new ObjectId().toString();
        await userRepository.incrementFailedAttempts(userId);
        expect(mockCollection.updateOne).toHaveBeenCalledWith(
            { _id: new ObjectId(userId) },
            {
                $inc: { failedLoginAttempts: 1 },
                $currentDate: { updatedAt: true }
            }
        );
    });

    it('should reset failed attempts when user is found', async () => {
        const userId = new ObjectId().toString();
        await userRepository.resetFailedAttempts(userId);
        expect(mockCollection.updateOne).toHaveBeenCalledWith(
            { _id: new ObjectId(userId) },
            {
                $set: {
                    failedLoginAttempts: 0,
                    lockUntil: undefined
                },
                $currentDate: { updatedAt: true }
            }
        );
    });

    it('should update last login when user is found', async () => {
        const userId = new ObjectId().toString();
        await userRepository.updateLastLogin(userId);
        expect(mockCollection.updateOne).toHaveBeenCalledWith(
            { _id: new ObjectId(userId) },
            {
                $set: {
                    lastLogin: expect.any(Date),
                    lastActiveAt: expect.any(Date)
                },
                $currentDate: { updatedAt: true }
            }
        );
    });

    it('should handle failed increment attempts when user not found', async () => {
        jest.spyOn(userRepository, 'findById').mockResolvedValue(null);
        await expect(userRepository.incrementFailedAttempts('invalid-id')).rejects.toThrow();
    });

    it('should handle failed reset attempts when user not found', async () => {
        jest.spyOn(userRepository, 'findById').mockResolvedValue(null);
        await expect(userRepository.resetFailedAttempts('invalid-id')).rejects.toThrow();
    });

    it('should handle failed last login update when user not found', async () => {
        jest.spyOn(userRepository, 'findById').mockResolvedValue(null);
        await expect(userRepository.updateLastLogin('invalid-id')).rejects.toThrow();
    });

    it('should return null when user not found by id', async () => {
        mockCollection.findOne.mockResolvedValueOnce(null);
        const result = await userRepository.findById(new ObjectId().toString());
        expect(result).toBeNull();
    });

    it('should handle invalid ObjectId', async () => {
        await expect(userRepository.findById('not-an-object-id'))
            .rejects
            .toThrow(new ApiError('Cannot connect to database', StatusCodes.INTERNAL_SERVER_ERROR, 'UserRepository'));
    });

    it('should handle database errors in findById', async () => {
        mockCollection.findOne.mockRejectedValueOnce(new Error('Database error'));
        await expect(userRepository.findById(new ObjectId().toString()))
            .rejects.toThrow('Cannot connect to database');
    });

    it('should find user by provider', async () => {
        const mockUser = { provider: 'google', providerId: '123', email: 'test@example.com' } as IUser;
        jest.spyOn(userRepository as any, 'findOne').mockResolvedValueOnce(mockUser);
        const result = await userRepository.findByProvider('google', '123');
        expect(result).toEqual(mockUser);
    });

    it('should handle database errors in findByProvider', async () => {
        jest.spyOn(userRepository as any, 'findOne').mockRejectedValueOnce(new Error('Database error'));
        await expect(userRepository.findByProvider('google', '123'))
            .rejects.toThrow('Cannot connect to database');
    });

    describe('updateActivity', () => {
        it('should update activity without deviceInfo', async () => {
            const userId = "507f1f77bcf86cd799439011";
            const updateOneSpy = jest
                .spyOn((userRepository as any).collection, 'updateOne')
                .mockResolvedValue({ modifiedCount: 1 } as any);

            await userRepository.updateActivity(userId);

            expect(updateOneSpy).toHaveBeenCalled();
            const callArgs = updateOneSpy.mock.calls[0];
            expect(callArgs[0]).toEqual({ _id: new ObjectId(userId) });


            const updateData = callArgs[1] as any;
            expect(updateData.$set).toHaveProperty('lastActiveAt');
            expect(updateData.$set).toHaveProperty('updatedAt');
            expect(updateData.$set).not.toHaveProperty('deviceInfo');
        });

        it('should update activity with deviceInfo', async () => {
            const userId = "507f1f77bcf86cd799439011";
            const deviceInfo: Request['deviceInfo'] = {
                userAgent: "Mozilla/5.0",
                ip: "127.0.0.1",
                platform: "linux",
                browser: "chrome",
                version: "1.0",
                os: "Linux",
                device: "desktop",
                manufacturer: "Dell",
                model: "XPS",
                isBot: false,
                isMobile: false,
            };

            const updateOneSpy = jest
                .spyOn((userRepository as any).collection, 'updateOne')
                .mockResolvedValue({ modifiedCount: 1 } as any);

            await userRepository.updateActivity(userId, deviceInfo);

            expect(updateOneSpy).toHaveBeenCalled();
            const callArgs = updateOneSpy.mock.calls[0];
            expect(callArgs[0]).toEqual({ _id: new ObjectId(userId) });
            const updateData = callArgs[1] as any;
            expect(updateData.$set).toHaveProperty('lastActiveAt');
            expect(updateData.$set).toHaveProperty('updatedAt');
            expect(updateData.$set).toHaveProperty('deviceInfo', deviceInfo);
        });

        it('should throw an ApiError when updateOne fails', async () => {
            const userId = "507f1f77bcf86cd799439011";
            jest.spyOn((userRepository as any).collection, 'updateOne').mockRejectedValue(new Error('update failed'));

            await expect(userRepository.updateActivity(userId)).rejects.toThrow(ApiError);
        });
    });

    it('should return inactivity time from aggregate result', async () => {
        const userId = new ObjectId().toString();
        const inactivityMinutes = 45;
        (mockCollection.aggregate as jest.Mock).mockReturnValueOnce({
            toArray: jest.fn().mockResolvedValueOnce([{ inactiveMinutes: inactivityMinutes }])
        });
        const result = await userRepository.getInactivityTime(userId);
        expect(result).toBe(inactivityMinutes);
    });

    it('should return 0 inactivity time if aggregate returns empty array', async () => {
        const userId = new ObjectId().toString();
        (mockCollection.aggregate as jest.Mock).mockReturnValueOnce({
            toArray: jest.fn().mockResolvedValueOnce([])
        });
        const result = await userRepository.getInactivityTime(userId);
        expect(result).toBe(0);
    });

    it('should handle database errors in getInactivityTime', async () => {
        const userId = new ObjectId().toString();
        (mockCollection.aggregate as jest.Mock).mockReturnValueOnce({
            toArray: jest.fn().mockRejectedValueOnce(new Error('Database error'))
        });
        await expect(userRepository.getInactivityTime(userId)).rejects.toThrow('Cannot connect to database');
    });

    it('should delete many users with provided filter', async () => {
        const filter = { email: /@example.com$/ };
        await userRepository.deleteMany(filter);
        expect(mockCollection.deleteMany).toHaveBeenCalledWith(filter);
    });

    it('should delete many users with default filter if none provided', async () => {
        await userRepository.deleteMany();
        expect(mockCollection.deleteMany).toHaveBeenCalledWith({});
    });

    it('should handle database errors in deleteMany', async () => {
        mockCollection.deleteMany.mockRejectedValueOnce(new Error('Database error'));
        await expect(userRepository.deleteMany({})).rejects.toThrow('Cannot connect to database');
    });

    it('should create indexes on instantiation', async () => {
        await Promise.resolve();
        expect(mockCollection.createIndex).toHaveBeenCalledWith(
            { lastActiveAt: 1 },
            { expireAfterSeconds: 60 * 60 * 24 * 30, background: true }
        );
    });
});
