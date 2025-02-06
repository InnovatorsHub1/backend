import { mockDbUser, mockProfile, mockUserResult } from '../../mock/authMock';
import { container } from '../../../src/core/di/container';
import { AuthService } from '../../../src/services/auth.service';
import { UserRepository } from '../../../src/repositories/UserRepository';
import { TYPES } from '../../../src/core/di/types';

describe('AuthService', () => {
    let authService: AuthService;
    let userRepository: jest.Mocked<UserRepository>;

    beforeEach(() => {
        userRepository = {
            upsertGoogleUser: jest.fn(),
            findByGoogleId: jest.fn(),
        } as any;

        // Safely unbind if exists
        if (container.isBound(TYPES.UserRepository)) {
            container.unbind(TYPES.UserRepository);
        }
        if (container.isBound(TYPES.AuthService)) {
            container.unbind(TYPES.AuthService);
        }

        container.bind(TYPES.UserRepository).toConstantValue(userRepository);
        container.bind(TYPES.AuthService).to(AuthService);
        authService = container.get<AuthService>(TYPES.AuthService);
    });

    afterEach(() => {
        // Clean up after each test
        if (container.isBound(TYPES.UserRepository)) {
            container.unbind(TYPES.UserRepository);
        }
        if (container.isBound(TYPES.AuthService)) {
            container.unbind(TYPES.AuthService);
        }
    });

    describe('validateOrCreateUser', () => {
        it('should create or update user from Google profile', async () => {
            userRepository.upsertGoogleUser.mockResolvedValue(mockDbUser);
            const result = await authService.validateOrCreateUser(mockProfile);
            expect(result).toEqual(mockUserResult);
        });
    });

    describe('isUserAuthenticated', () => {
        it('should return true for authenticated user', async () => {
            userRepository.findByGoogleId.mockResolvedValue(mockDbUser);
            const result = await authService.isUserAuthenticated('123');
            expect(result).toBe(true);
        });

        it('should return false for non-authenticated user', async () => {
            userRepository.findByGoogleId.mockResolvedValue(null);
            const result = await authService.isUserAuthenticated('123');
            expect(result).toBe(false);
        });
    });
});
