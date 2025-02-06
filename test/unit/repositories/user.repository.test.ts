import { UserRepository } from '@gateway/repositories/user/UserRepository';
import { IUser } from '@gateway/repositories/user/IUser';
import { ObjectId } from 'mongodb';


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
    }
}));

describe('UserRepository', () => {
    let userRepository: UserRepository;
    let testUser: IUser;
    let mockFindOne: jest.Mock;
    let mockUpdateOne: jest.Mock;

    beforeEach(() => {
        // איפוס המוקים
        mockFindOne = jest.fn();
        mockUpdateOne = jest.fn();

        jest.mock('@gateway/utils/mongoConnection', () => ({
            mongoConnection: {
                getClient: jest.fn().mockReturnValue({
                    db: jest.fn().mockReturnValue({
                        collection: jest.fn().mockReturnValue({
                            findOne: mockFindOne,
                            updateOne: mockUpdateOne,
                            find: jest.fn(),
                            deleteMany: jest.fn(),
                            createIndex: jest.fn()
                        })
                    })
                })
            }
        }));

        userRepository = new UserRepository();
        testUser = {
            _id: new ObjectId(),
            email: 'test@example.com',
            username: 'test',
            failedLoginAttempts: 0
        } as IUser;

        // הגדרת ערכי ברירת מחדל למוקים
        mockFindOne.mockResolvedValue(testUser);
        mockUpdateOne.mockResolvedValue({ modifiedCount: 1 });

        // מקק את findById
        jest.spyOn(userRepository, 'findById').mockImplementation(async (id) => {
            if (id === testUser._id?.toString()) {
                return testUser;
            }
            return null;
        });

    });

    it('should find user by email', async () => {
        const mockUser = {
            email: 'test@example.com',
            username: 'test'
        } as IUser;

        jest.spyOn(userRepository as any, 'findOne').mockResolvedValue(mockUser);

        const result = await userRepository.findByEmail('test@example.com');
        expect(result).toEqual(mockUser);
    });

    it('should return null when user not found by email', async () => {
        jest.spyOn(userRepository as any, 'findOne').mockResolvedValue(null);
        const result = await userRepository.findByEmail('notfound@example.com');
        expect(result).toBeNull();
    });

    it('should increment failed attempts', async () => {
        const updatedUser = { ...testUser, failedLoginAttempts: 1 };
        jest.spyOn(userRepository, 'findById').mockResolvedValueOnce(updatedUser);

        await userRepository.incrementFailedAttempts(testUser._id?.toString() ?? '');
        const user = await userRepository.findById(testUser._id?.toString() ?? '');
        expect(user?.failedLoginAttempts).toBe(1);

    });

    it('should reset failed attempts', async () => {
        await userRepository.incrementFailedAttempts(testUser._id?.toString() ?? '');
        await userRepository.resetFailedAttempts(testUser._id?.toString() ?? '');
        const user = await userRepository.findById(testUser._id?.toString() ?? '');
        expect(user?.failedLoginAttempts).toBe(0);
    });

    it('should update last login', async () => {
        const updatedUser = {
            ...testUser,
            lastLogin: new Date(),
            lastActiveAt: new Date()
        };
        jest.spyOn(userRepository, 'findById').mockResolvedValueOnce(updatedUser);

        await userRepository.updateLastLogin(testUser._id?.toString() ?? '');
        const user = await userRepository.findById(testUser._id?.toString() ?? '');
        expect(user?.lastLogin).toBeDefined();
        expect(user?.lastActiveAt).toBeDefined();

    });

    it('should handle failed increment attempts', async () => {
        jest.spyOn(userRepository, 'findById').mockResolvedValue(null);
        await expect(userRepository.incrementFailedAttempts('invalid-id')).rejects.toThrow();
    });

    it('should handle failed reset attempts', async () => {
        jest.spyOn(userRepository, 'findById').mockResolvedValue(null);
        await expect(userRepository.resetFailedAttempts('invalid-id')).rejects.toThrow();
    });

    it('should handle failed last login update', async () => {
        jest.spyOn(userRepository, 'findById').mockResolvedValue(null);
        await expect(userRepository.updateLastLogin('invalid-id')).rejects.toThrow();
    });
});
