import { UserRepository } from '@gateway/repositories/user/UserRepository';
import { IUser } from '@gateway/repositories/user/IUser';
import { Collection, ObjectId } from 'mongodb';
import { ApiError } from '@gateway/core/errors/api.error';
import { StatusCodes } from 'http-status-codes';
import { Request } from 'express';

let mockMongoConnection: any;

jest.mock('@gateway/utils/mongoConnection', () => ({
    getMongoConnection: () => mockMongoConnection,
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
            aggregate: jest.fn(),
            insertOne: jest.fn(),
        } as unknown as jest.Mocked<Collection<IUser>>;

        mockMongoConnection = {
            connect: jest.fn().mockResolvedValue(undefined),
            getClient: jest.fn().mockReturnValue({
                db: jest.fn().mockReturnValue({
                    collection: jest.fn().mockReturnValue(mockCollection),
                }),
            }),
        };

        userRepository = new UserRepository();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('findByEmail', () => {
        it('should find user by email', async () => {
            const mockUser: IUser = {
                email: 'test@example.com',
                username: 'test',
                isDeleted: false,
                createdAt: new Date(),
                updatedAt: new Date()
            } as IUser;
            (mockCollection.findOne as jest.Mock).mockResolvedValueOnce(mockUser);
            const result = await userRepository.findByEmail('test@example.com');
            expect(result).toEqual(mockUser);
        });

        it('should return null when user not found by email', async () => {
            (mockCollection.findOne as jest.Mock).mockResolvedValueOnce(null);
            const result = await userRepository.findByEmail('notfound@example.com');
            expect(result).toBeNull();
        });
    });

    describe('incrementFailedAttempts', () => {
        it('should increment failed attempts when user is found', async () => {
            const userId = new ObjectId().toString();
            const dummyUser: IUser = {
                _id: new ObjectId(userId),
                isDeleted: false,
                createdAt: new Date(),
                updatedAt: new Date(),
            } as IUser;
            jest.spyOn(userRepository, 'findById').mockResolvedValueOnce(dummyUser);
            await userRepository.incrementFailedAttempts(userId);
            expect(mockCollection.updateOne).toHaveBeenCalledWith(
                { _id: new ObjectId(userId) },
                {
                    $inc: { failedLoginAttempts: 1 },
                    $currentDate: { updatedAt: true }
                }
            );
        });

        it('should handle failed increment attempts when user not found', async () => {
            jest.spyOn(userRepository, 'findById').mockResolvedValueOnce(null);
            await expect(userRepository.incrementFailedAttempts('invalid-id')).rejects.toThrow();
        });
    });

    describe('resetFailedAttempts', () => {
        it('should reset failed attempts when user is found', async () => {
            const userId = new ObjectId().toString();
            const dummyUser: IUser = {
                _id: new ObjectId(userId),
                isDeleted: false,
                createdAt: new Date(),
                updatedAt: new Date()
            } as IUser;
            jest.spyOn(userRepository, 'findById').mockResolvedValueOnce(dummyUser);
            await userRepository.resetFailedAttempts(userId);
            expect(mockCollection.updateOne).toHaveBeenCalledWith(
                { _id: new ObjectId(userId) },
                {
                    $set: { failedLoginAttempts: 0, lockUntil: undefined },
                    $currentDate: { updatedAt: true }
                }
            );
        });

        it('should handle failed reset attempts when user not found', async () => {
            jest.spyOn(userRepository, 'findById').mockResolvedValueOnce(null);
            await expect(userRepository.resetFailedAttempts('invalid-id')).rejects.toThrow();
        });
    });

    describe('updateLastLogin', () => {
        it('should update last login when user is found', async () => {
            const userId = new ObjectId().toString();
            const dummyUser: IUser = {
                _id: new ObjectId(userId),
                isDeleted: false,
                lastLogin: new Date(),
                lastActiveAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            } as IUser;

            // מדמים שהמתודה findById מחזירה את המשתמש הדמיוני
            jest.spyOn(userRepository, 'findById').mockResolvedValueOnce(dummyUser);
            // מדמים את קריאת updateOne שצריכה לעדכן את הנתונים בהצלחה
            (mockCollection.updateOne as jest.Mock).mockResolvedValueOnce({ modifiedCount: 1 });

            await userRepository.updateLastLogin(userId);

            // ודא שקריאת updateOne מתבצעת עם הפרמטרים הנכונים - כולל updatedAt בתוך $set
            expect(mockCollection.updateOne).toHaveBeenCalledWith(
                { _id: new ObjectId(userId) },
                {
                    $set: {
                        lastLogin: expect.any(Date),
                        lastActiveAt: expect.any(Date),
                        updatedAt: expect.any(Date)
                    }
                }
            );
        });

        it('should handle failed last login update when user not found', async () => {
            jest.spyOn(userRepository, 'findById').mockResolvedValueOnce(null);
            await expect(userRepository.updateLastLogin('invalid-id')).rejects.toThrow();
        });
    });

    describe('findById', () => {
        it('should return null when user not found by id', async () => {
            (mockCollection.findOne as jest.Mock).mockResolvedValueOnce(null);
            const result = await userRepository.findById(new ObjectId().toString());
            expect(result).toBeNull();
        });

        it('should handle invalid ObjectId', async () => {
            await expect(userRepository.findById('not-an-object-id')).rejects.toThrow(
                new ApiError('Cannot connect to database', StatusCodes.INTERNAL_SERVER_ERROR, 'UserRepository')
            );
        });

        it('should handle database errors in findById', async () => {
            (mockCollection.findOne as jest.Mock).mockRejectedValueOnce(new Error('Database error'));
            await expect(userRepository.findById(new ObjectId().toString()))
                .rejects
                .toThrow('Cannot connect to database');
        });
    });

    describe('findByProvider', () => {
        it('should find user by provider', async () => {
            const mockUser: IUser = {
                provider: 'google',
                providerId: '123',
                email: 'test@example.com',
                isDeleted: false,
                createdAt: new Date(),
                updatedAt: new Date()
            } as IUser;
            jest.spyOn(userRepository as any, 'findOne').mockResolvedValueOnce(mockUser);
            const result = await userRepository.findByProvider('google', '123');
            expect(result).toEqual(mockUser);
        });

        it('should handle database errors in findByProvider', async () => {
            jest.spyOn(userRepository as any, 'findOne').mockRejectedValueOnce(new Error('Database error'));
            await expect(userRepository.findByProvider('google', '123'))
                .rejects.toThrow('Cannot connect to database');
        });
    });

    describe('updateActivity', () => {
        it('should update activity without deviceInfo', async () => {
            const userId = new ObjectId("507f1f77bcf86cd799439011").toString();
            (mockCollection.updateOne as jest.Mock).mockResolvedValueOnce({ modifiedCount: 1 });
            await userRepository.updateActivity(userId);
            expect(mockCollection.updateOne).toHaveBeenCalled();
            const callArgs = (mockCollection.updateOne as jest.Mock).mock.calls[0];
            expect(callArgs[0]).toEqual({ _id: new ObjectId(userId) });
            const updateData = callArgs[1];
            expect(updateData.$set).toHaveProperty('lastActiveAt');
            expect(updateData.$set).toHaveProperty('updatedAt');
            expect(updateData.$set).not.toHaveProperty('deviceInfo');
        });

        it('should update activity with deviceInfo', async () => {
            const userId = new ObjectId("507f1f77bcf86cd799439011").toString();
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
            (mockCollection.updateOne as jest.Mock).mockResolvedValueOnce({ modifiedCount: 1 });
            await userRepository.updateActivity(userId, deviceInfo);
            expect(mockCollection.updateOne).toHaveBeenCalled();
            const callArgs = (mockCollection.updateOne as jest.Mock).mock.calls[0];
            expect(callArgs[0]).toEqual({ _id: new ObjectId(userId) });
            const updateData = callArgs[1];
            expect(updateData.$set).toHaveProperty('lastActiveAt');
            expect(updateData.$set).toHaveProperty('updatedAt');
            expect(updateData.$set).toHaveProperty('deviceInfo', deviceInfo);
        });

        it('should throw an ApiError when updateOne fails in updateActivity', async () => {
            const userId = new ObjectId("507f1f77bcf86cd799439011").toString();
            (mockCollection.updateOne as jest.Mock).mockRejectedValueOnce(new Error('update failed'));
            await expect(userRepository.updateActivity(userId)).rejects.toThrow(ApiError);
        });
    });

    describe('getInactivityTime', () => {
        it('should return inactivity time from aggregate result', async () => {
            const userId = new ObjectId().toString();
            const inactivityMinutes = 0;
            (mockCollection.aggregate as jest.Mock).mockReturnValueOnce({
                toArray: jest.fn().mockResolvedValueOnce([{ inactivityMinutes }])
            });
            const result = await userRepository.getInactivityTime(userId);
            expect(result).toEqual(inactivityMinutes);
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
                toArray: jest.fn().mockRejectedValueOnce(
                    new ApiError('Cannot connect to database', StatusCodes.INTERNAL_SERVER_ERROR, 'UserRepository')
                )
            });
            await expect(userRepository.getInactivityTime(userId))
                .rejects.toThrow('Cannot connect to database');
        });
    });

    describe('deleteMany', () => {
        it('should delete many users with provided filter', async () => {
            const filter = { email: /@example.com$/ };
            (mockCollection.deleteMany as jest.Mock).mockResolvedValueOnce({ deletedCount: 1 });
            await userRepository.deleteMany(filter);
            expect(mockCollection.deleteMany).toHaveBeenCalledWith(filter);
        });

        it('should delete many users with default filter if none provided', async () => {
            (mockCollection.deleteMany as jest.Mock).mockResolvedValueOnce({ deletedCount: 1 });
            await userRepository.deleteMany();
            expect(mockCollection.deleteMany).toHaveBeenCalledWith({});
        });

        it('should handle database errors in deleteMany', async () => {
            (mockCollection.deleteMany as jest.Mock).mockRejectedValueOnce(new Error('Database error'));
            await expect(userRepository.deleteMany({}))
                .rejects.toThrow('Cannot connect to database');
        });
    });

    describe('create indexes', () => {
        it('should create indexes on instantiation', async () => {
            expect(mockCollection.createIndex).toHaveBeenCalledWith(
                { lastActiveAt: 1 },
                { expireAfterSeconds: 60 * 60 * 24 * 30, background: true }
            );
        });
    });
});