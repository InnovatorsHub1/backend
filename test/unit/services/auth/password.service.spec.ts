import { PasswordService } from '@gateway/services/auth/password.service';
import { ApiError } from '@gateway/core/errors/api.error';
import * as bcrypt from 'bcrypt';
import { StatusCodes } from 'http-status-codes';

jest.mock('bcrypt', () => ({
    hash: jest.fn().mockResolvedValue('hashedPassword'),
    compare: jest.fn().mockResolvedValue(true)
}), { virtual: true });

describe('PasswordService', () => {
    let passwordService: PasswordService;
    let mockHash: jest.SpyInstance;
    let mockCompare: jest.SpyInstance;

    beforeEach(() => {
        passwordService = new PasswordService();
        mockHash = jest.spyOn(bcrypt, 'hash');
        mockCompare = jest.spyOn(bcrypt, 'compare');

        // Default implementations
        mockHash.mockImplementation((password: string) => Promise.resolve(`hashed_${password}`));
        mockCompare.mockImplementation(() => Promise.resolve(false));
    });

    afterEach(() => {
        mockHash.mockRestore();
        mockCompare.mockRestore();
    });

    describe('validatePassword', () => {
        it('should accept valid password', () => {
            expect(() =>
                passwordService['validatePassword']('Test123!@')
            ).not.toThrow();
        });

        it('should reject password without uppercase', () => {
            expect(() =>
                passwordService['validatePassword']('test123!@')
            ).toThrow(ApiError);
        });

        it('should reject password without lowercase', () => {
            expect(() =>
                passwordService['validatePassword']('TEST123!@')
            ).toThrow(ApiError);
        });

        it('should reject password without number', () => {
            expect(() =>
                passwordService['validatePassword']('TestTest!@')
            ).toThrow(ApiError);
        });

        it('should reject password without special char', () => {
            expect(() =>
                passwordService['validatePassword']('Test12345')
            ).toThrow(ApiError);
        });

        it('should reject short password', () => {
            expect(() =>
                passwordService['validatePassword']('Te1!@')
            ).toThrow(ApiError);
        });
    });

    describe('hashPassword', () => {
        it('should hash valid password', async () => {
            const password = 'Test123!@';
            const hash = await passwordService['hashPassword'](password);
            expect(hash).toBeTruthy();
            expect(hash).not.toBe(password);
            expect(typeof hash).toBe('string');
            expect(hash.length).toBeGreaterThan(0);
        });

        it('should throw ApiError when bcrypt fails', async () => {
            // Override default implementation for this test only
            mockHash.mockRejectedValueOnce(new Error('Bcrypt internal error'));

            await expect(passwordService.hashPassword('Test123!@'))
                .rejects
                .toThrow(ApiError);
        });

        it('should throw error for non-string password', async () => {
            await expect(passwordService.hashPassword(123 as any))
                .rejects
                .toThrow(new ApiError('Invalid password format', StatusCodes.BAD_REQUEST, 'PasswordService'));
        });
    });

    describe('comparePassword', () => {
        it('should return true for matching password', async () => {
            // Override default implementation for this test only
            mockCompare.mockResolvedValueOnce(true);

            const result = await passwordService.comparePassword('password123', 'hashedPassword');
            expect(result).toBe(true);
        });

        it('should return false for non-matching password', async () => {
            const mockCompare = jest.spyOn(bcrypt, 'compare');
            mockCompare.mockResolvedValue(false as never);

            const result = await passwordService.comparePassword('wrongPassword', 'hashedPassword');
            expect(result).toBe(false);

            mockCompare.mockRestore();
        });
    });
}); 