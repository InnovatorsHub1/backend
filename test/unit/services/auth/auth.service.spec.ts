import { AuthService } from '@gateway/services/auth/auth.service';
import { UserRepository } from '@gateway/repositories/user/UserRepository';
import { PasswordService } from '@gateway/services/auth/password.service';
import { SessionService } from '@gateway/services/auth/session.service';
import { ApiError } from '@gateway/core/errors/api.error';
import { ObjectId } from 'mongodb';
import { StatusCodes } from 'http-status-codes';
import { ICredentialsUser, ISSOUser } from '@gateway/repositories/user/IUser';
import { JwtService } from '@gateway/services/jwt/jwt.service';
import { Request } from 'express';

describe('AuthService', () => {
    let authService: AuthService;
    let userRepository: jest.Mocked<UserRepository>;
    let passwordService: jest.Mocked<PasswordService>;
    let sessionService: jest.Mocked<SessionService>;
    let jwtService: jest.Mocked<JwtService>;
    beforeEach(() => {
        userRepository = {
            findByEmail: jest.fn(),
            incrementFailedAttempts: jest.fn(),
            resetFailedAttempts: jest.fn(),
            updateLastLogin: jest.fn(),
            create: jest.fn()
        } as any;

        passwordService = {
            comparePassword: jest.fn(),
            hashPassword: jest.fn()
        } as any;

        sessionService = {
            createSession: jest.fn()
        } as any;

        jwtService = {
            generateToken: jest.fn(),
            generateRefreshToken: jest.fn(),
            verifyRefreshToken: jest.fn()
        } as any;

        authService = new AuthService(userRepository, passwordService, sessionService, jwtService);
    });

    describe('login', () => {
        it('should successfully login user', async () => {
            const mockUser: ICredentialsUser = {
                _id: new ObjectId() as unknown as ObjectId,
                email: 'test@example.com',
                username: 'testuser',
                password: 'hashedPassword',
                isEmailVerified: true,
                failedLoginAttempts: 0,
                lastActiveAt: new Date(),
                profile: {},
                role: 'user',
                roleExp: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
                permissions: [],
                isActive: true,
                isDeleted: false,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            userRepository.findByEmail.mockResolvedValue(mockUser);
            passwordService.comparePassword.mockResolvedValue(true);
            sessionService.createSession.mockResolvedValue();

            await authService.login('test@example.com', 'Password123@', { userAgent: 'test-agent' });

            expect(userRepository.resetFailedAttempts).toHaveBeenCalled();
            expect(userRepository.updateLastLogin).toHaveBeenCalled();
            expect(sessionService.createSession).toHaveBeenCalled();
        });

        it('should throw on user not found', async () => {
            userRepository.findByEmail.mockResolvedValue(null);

            await expect(authService.login('wrong@example.com', 'Password123@', { userAgent: 'test-agent' }))
                .rejects
                .toThrow(new ApiError('Invalid credentials', StatusCodes.UNAUTHORIZED, 'AuthService'));
        });

        it('should throw on SSO user login attempt', async () => {
            const ssoUser: ISSOUser = {
                _id: new ObjectId(),
                email: 'test@example.com',
                username: 'testuser',
                provider: 'google',
                providerId: 'google123',
                failedLoginAttempts: 0,
                lastActiveAt: new Date(),
                profile: {},
                role: 'user',
                roleExp: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
                permissions: [],
                isActive: true,
                isDeleted: false,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            userRepository.findByEmail.mockResolvedValue(ssoUser as unknown as ICredentialsUser);

            await expect(authService.login('test@example.com', 'Password123@', { userAgent: 'test-agent' }))
                .rejects
                .toThrow(new ApiError('Invalid credentials', StatusCodes.UNAUTHORIZED, 'AuthService'));
        });

        it('should throw on locked account', async () => {
            const lockedUser: ICredentialsUser = {
                _id: new ObjectId(),
                email: 'test@example.com',
                username: 'testuser',
                password: 'hashedPassword',
                isEmailVerified: true,
                failedLoginAttempts: 5,
                lockUntil: new Date(Date.now() + 3600000), // locked for 1 hour
                lastActiveAt: new Date(),
                profile: {},
                role: 'user',
                roleExp: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
                permissions: [],
                isActive: true,
                isDeleted: false,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            userRepository.findByEmail.mockResolvedValue(lockedUser);

            await expect(authService.login('test@example.com', 'Password123@', { userAgent: 'test-agent' }))
                .rejects
                .toThrow(new ApiError('Account is locked', StatusCodes.UNAUTHORIZED, 'AuthService'));
        });

        it('should handle failed login attempt', async () => {
            const mockUser: ICredentialsUser = {
                _id: new ObjectId() as unknown as ObjectId,
                email: 'test@example.com',
                username: 'testuser',
                password: 'hashedPassword',
                isEmailVerified: true,
                failedLoginAttempts: 0,
                lastActiveAt: new Date(),
                profile: {},
                role: 'user',
                roleExp: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
                permissions: [],
                isActive: true,
                isDeleted: false,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            userRepository.findByEmail.mockResolvedValue(mockUser);
            passwordService.comparePassword.mockResolvedValue(false);

            await expect(authService.login('test@example.com', 'Password123@', { userAgent: 'test-agent' }))
                .rejects
                .toThrow(new ApiError('Invalid credentials', StatusCodes.UNAUTHORIZED, 'AuthService'));

            expect(userRepository.incrementFailedAttempts).toHaveBeenCalledWith(mockUser._id!.toString());
        });

        it('should handle login with device info', async () => {
            const mockUser: ICredentialsUser = {
                _id: new ObjectId() as unknown as ObjectId,
                email: 'test@example.com',
                username: 'testuser',
                password: 'hashedPassword',
                isEmailVerified: true,
                failedLoginAttempts: 0,
                lastActiveAt: new Date(),
                profile: {},
                role: 'user',
                roleExp: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
                permissions: [],
                isActive: true,
                isDeleted: false,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            userRepository.findByEmail.mockResolvedValue(mockUser);
            passwordService.comparePassword.mockResolvedValue(true);

            await authService.login('test@example.com', 'password123', { userAgent: 'test-agent', ip: '127.0.0.1' });

            expect(sessionService.createSession).toHaveBeenCalledWith(
                mockUser,
                {
                    ip: '127.0.0.1',
                    userAgent: 'test-agent'
                }
            );
        });

        it('should throw when password service fails', async () => {
            const mockUser: ICredentialsUser = {
                _id: new ObjectId() as unknown as ObjectId,
                email: 'test@example.com',
                username: 'testuser',
                password: 'hashedPassword',
                isEmailVerified: true,
                failedLoginAttempts: 0,
                lastActiveAt: new Date(),
                profile: {},
                role: 'user',
                roleExp: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
                permissions: [],
                isActive: true,
                isDeleted: false,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            userRepository.findByEmail.mockResolvedValue(mockUser);
            passwordService.comparePassword.mockRejectedValue(
                new ApiError('Invalid credentials', StatusCodes.UNAUTHORIZED, 'AuthService')
            );

            await expect(authService.login('test@example.com', 'password123', { userAgent: 'test-agent' }))
                .rejects
                .toThrow(ApiError);
        });

        it('should throw when session creation fails', async () => {
            const mockUser: ICredentialsUser = {
                _id: new ObjectId() as unknown as ObjectId,
                email: 'test@example.com',
                username: 'testuser',
                password: 'hashedPassword',
                isEmailVerified: true,
                failedLoginAttempts: 0,
                lastActiveAt: new Date(),
                profile: {},
                role: 'user',
                roleExp: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
                permissions: [],
                isActive: true,
                isDeleted: false,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            userRepository.findByEmail.mockResolvedValue(mockUser);
            passwordService.comparePassword.mockResolvedValue(true);
            sessionService.createSession.mockRejectedValue(new Error('Session creation failed'));

            await expect(authService.login('test@example.com', 'password123', { userAgent: 'test-agent' }))
                .rejects
                .toThrow(ApiError);
        });

        it('should throw when failed attempts update fails', async () => {
            const mockUser: ICredentialsUser = {
                _id: new ObjectId() as unknown as ObjectId,
                email: 'test@example.com',
                username: 'testuser',
                password: 'hashedPassword',
                isEmailVerified: true,
                failedLoginAttempts: 0,
                lastActiveAt: new Date(),
                profile: {},
                role: 'user',
                roleExp: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
                permissions: [],
                isActive: true,
                isDeleted: false,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            userRepository.findByEmail.mockResolvedValue(mockUser);
            passwordService.comparePassword.mockResolvedValue(false);
            userRepository.incrementFailedAttempts.mockRejectedValue(new Error('Update failed'));

            await expect(authService.login('test@example.com', 'wrongpassword', { userAgent: 'test-agent' }))
                .rejects
                .toThrow(ApiError);
        });

        it('should rethrow ApiError', async () => {
            const mockDeviceInfo: Request['deviceInfo'] = {
                userAgent: 'test-agent',
                ip: '127.0.0.1',
                platform: 'test'
            };
            const apiError = new ApiError('Test error', StatusCodes.BAD_REQUEST, 'AuthService');
            userRepository.findByEmail.mockRejectedValue(apiError);

            await expect(authService.login('test@example.com', 'password123', mockDeviceInfo))
                .rejects
                .toThrow(apiError);
        });

        it('should throw invalid email format error', async () => {
            const mockDeviceInfo: Request['deviceInfo'] = {
                userAgent: 'test-agent',
                ip: '127.0.0.1',
                platform: 'test'
            };

            await expect(authService.login('invalid-email', 'password123', mockDeviceInfo))
                .rejects
                .toThrow(new ApiError('Invalid email format', StatusCodes.BAD_REQUEST, 'AuthService'));
        });
    });

    describe('signup', () => {
        beforeEach(() => {
            (authService as any).validateEmail = jest.fn();
            passwordService.hashPassword = jest.fn();
            userRepository.create = jest.fn();
        });

        it('should throw an error if user already exists', async () => {
            const reqBody: Partial<ICredentialsUser> = {
                email: 'test@example.com',
                password: 'Password123@',
                profile: {}
            };

            (userRepository.findByEmail as jest.Mock).mockResolvedValue({
                _id: new ObjectId() as unknown as ObjectId,
                email: reqBody.email,
                password: 'hashedPassword',
            });
            await expect(authService.signup(reqBody))
                .rejects
                .toThrow(new ApiError('User already exists', StatusCodes.CONFLICT, 'AuthService'));
        });

        it('should successfully signup a user', async () => {
            const reqBody: Partial<ICredentialsUser> = {
                email: 'test@example.com',
                password: 'Password123@',
                profile: {}
            };

            (passwordService.hashPassword as jest.Mock).mockResolvedValue('hashedPassword');

            const createdUser = {
                _id: new ObjectId() as unknown as ObjectId,
                email: reqBody.email,
                password: 'hashedPassword',
                profile: reqBody.profile,
                role: 'user',
                roleExp: reqBody.roleExp || new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
                permissions: reqBody.permissions || ['read'],
                isActive: true,
                isEmailVerified: false,
                lastActiveAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            };

            (userRepository.create as jest.Mock).mockReturnValue(createdUser);

            const result = await authService.signup(reqBody);

            expect((authService as any).validateEmail).toHaveBeenCalledWith(reqBody.email);
            expect(passwordService.hashPassword).toHaveBeenCalledWith(reqBody.password);
            expect(userRepository.create).toHaveBeenCalled();
            expect(result).toEqual(createdUser);
        });

        it('should throw an error if user creation fails', async () => {
            const reqBody: Partial<ICredentialsUser> = {
                email: 'fail@example.com',
                password: 'Password123@',
                profile: {}
            };

            (passwordService.hashPassword as jest.Mock).mockResolvedValue('hashedPassword');
            (userRepository.create as jest.Mock).mockReturnValue(null);

            await expect(authService.signup(reqBody))
                .rejects
                .toThrow(new ApiError('Failed to create user', StatusCodes.INTERNAL_SERVER_ERROR, 'AuthService'));
        });

        it('should throw an error if email validation fails', async () => {
            const reqBody: Partial<ICredentialsUser> = {
                email: 'invalid-email',
                password: 'Password123@',
                profile: {}
            };

            (authService as any).validateEmail.mockImplementation(() => {
                throw new Error('Invalid email format');
            });

            await expect(authService.signup(reqBody))
                .rejects
                .toThrow('Invalid email format');
        });
    });
}); 