import { SessionService } from '@gateway/services/auth/session.service';
import { JwtService } from '@gateway/services/jwt/index';
import { UserRepository } from '@gateway/repositories/user/UserRepository';
import { ObjectId } from 'mongodb';
import { ApiError } from '@gateway/core/errors/api.error';
import { DeviceInfo } from '@gateway/services/auth/types'

describe('SessionService', () => {
    let sessionService: SessionService;
    let jwtService: jest.Mocked<JwtService>;
    let userRepository: jest.Mocked<UserRepository>;

    beforeEach(() => {
        jwtService = {
            generateToken: jest.fn(),
            verifyToken: jest.fn()
        } as any;

        userRepository = {
            findById: jest.fn(),
            updateActivity: jest.fn()
        } as any;

        sessionService = new SessionService(jwtService, userRepository);
    });

    describe('createSession', () => {
        it('should create a session successfully', async () => {
            const userId = new ObjectId().toString();
            const deviceInfo: DeviceInfo = {
                userAgent: 'Mozilla/5.0',
                ip: '127.0.0.1',
                platform: 'Windows',
                browser: 'Chrome',
                version: '91.0.4472.124',
                os: 'Windows 10',
                device: 'Desktop',
                manufacturer: 'Unknown',
                isBot: false,
                isMobile: false
            };
            const mockToken = 'mock-token';

            userRepository.findById.mockResolvedValue({
                _id: new ObjectId(userId),
                roles: ['user']
            } as any);

            jwtService.generateToken.mockReturnValue(mockToken);

            const token = await sessionService.createSession(userId, deviceInfo);

            expect(userRepository.updateActivity).toHaveBeenCalledWith(userId);
            expect(jwtService.generateToken).toHaveBeenCalledWith(expect.objectContaining({
                sub: userId,
                deviceInfo
            }));
            expect(token).toBe(mockToken);
        });

        it('should handle partial device info', async () => {
            const userId = new ObjectId().toString();
            const deviceInfo: DeviceInfo = {
                userAgent: 'Mozilla/5.0',
                ip: '127.0.0.1'
            };

            userRepository.findById.mockResolvedValue({
                _id: new ObjectId(userId),
                roles: ['user']
            } as any);

            await sessionService.createSession(userId, deviceInfo);

            expect(jwtService.generateToken).toHaveBeenCalledWith(expect.objectContaining({
                deviceInfo: expect.objectContaining({
                    userAgent: 'Mozilla/5.0',
                    ip: '127.0.0.1'
                })
            }));
        });

        it('should throw when user not found', async () => {
            const userId = new ObjectId().toString();
            userRepository.findById.mockResolvedValue(null);

            await expect(sessionService.createSession(userId, {} as DeviceInfo))
                .rejects
                .toThrow(ApiError);
        });
    });

    describe('validateSession', () => {
        it('should return true for valid token', () => {
            jwtService.verifyToken.mockReturnValue({ sub: 'userId' });

            const result = sessionService.validateSession('valid-token');

            expect(result).toBe(true);
        });

        it('should return false for invalid token', () => {
            jwtService.verifyToken.mockImplementation(() => {
                throw new Error('Invalid token');
            });

            const result = sessionService.validateSession('invalid-token');

            expect(result).toBe(false);
        });
    });

    describe('updateActivity', () => {
        it('should update user activity', async () => {
            const userId = 'test-user-id';

            await sessionService.updateActivity(userId);

            expect(userRepository.updateActivity).toHaveBeenCalledWith(userId);
        });

        it('should throw when update fails', async () => {
            const userId = 'test-user-id';
            userRepository.updateActivity.mockRejectedValue(new Error('Update failed'));

            await expect(sessionService.updateActivity(userId))
                .rejects
                .toThrow(ApiError);
        });
    });
}); 