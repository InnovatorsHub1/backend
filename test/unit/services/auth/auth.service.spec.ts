import { AuthService } from '@gateway/services/auth/auth.service';
import { UserRepository } from '@gateway/repositories/user/UserRepository';
import { PasswordService } from '@gateway/services/auth/password.service';
import { SessionService } from '@gateway/services/auth/session.service';
import { ApiError } from '@gateway/core/errors/api.error';
import { ObjectId } from 'mongodb';
import { StatusCodes } from 'http-status-codes';
import { ICredentialsUser, ISSOUser } from '@gateway/repositories/user/IUser';
import { JwtService } from '@gateway/services/jwt';
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
            updateLastLogin: jest.fn()
        } as any;

        passwordService = {
            comparePassword: jest.fn()
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
                permissions: [],
                isActive: true,
                isDeleted: false,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            userRepository.findByEmail.mockResolvedValue(mockUser);
            passwordService.comparePassword.mockResolvedValue(true);
            sessionService.createSession.mockResolvedValue({
                accessToken: 'token',
                refreshToken: 'refreshToken',
                id: mockUser._id!.toString()
            });

            await authService.login('test@example.com', 'Password123@');

            expect(userRepository.resetFailedAttempts).toHaveBeenCalled();
            expect(userRepository.updateLastLogin).toHaveBeenCalled();
            expect(sessionService.createSession).toHaveBeenCalled();
        });

        it('should throw on user not found', async () => {
            userRepository.findByEmail.mockResolvedValue(null);

            await expect(authService.login('wrong@example.com', 'Password123@'))
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
                permissions: [],
                isActive: true,
                isDeleted: false,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            userRepository.findByEmail.mockResolvedValue(ssoUser as unknown as ICredentialsUser);

            await expect(authService.login('test@example.com', 'Password123@'))
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
                permissions: [],
                isActive: true,
                isDeleted: false,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            userRepository.findByEmail.mockResolvedValue(lockedUser);

            await expect(authService.login('test@example.com', 'Password123@'))
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
                permissions: [],
                isActive: true,
                isDeleted: false,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            userRepository.findByEmail.mockResolvedValue(mockUser);
            passwordService.comparePassword.mockResolvedValue(false);

            await expect(authService.login('test@example.com', 'Password123@!'))
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
                permissions: [],
                isActive: true,
                isDeleted: false,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            const deviceInfo = { userAgent: 'test-agent' };

            userRepository.findByEmail.mockResolvedValue(mockUser);
            passwordService.comparePassword.mockResolvedValue(true);

            await authService.login('test@example.com', 'password123', deviceInfo as Request['deviceInfo']);

            expect(sessionService.createSession).toHaveBeenCalledWith(
                mockUser._id!.toString(),
                deviceInfo
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

            await expect(authService.login('test@example.com', 'password123'))
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
                permissions: [],
                isActive: true,
                isDeleted: false,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            userRepository.findByEmail.mockResolvedValue(mockUser);
            passwordService.comparePassword.mockResolvedValue(true);
            sessionService.createSession.mockRejectedValue(new Error('Session creation failed'));

            await expect(authService.login('test@example.com', 'password123'))
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
                permissions: [],
                isActive: true,
                isDeleted: false,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            userRepository.findByEmail.mockResolvedValue(mockUser);
            passwordService.comparePassword.mockResolvedValue(false);
            userRepository.incrementFailedAttempts.mockRejectedValue(new Error('Update failed'));

            await expect(authService.login('test@example.com', 'wrongpassword'))
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
}); 