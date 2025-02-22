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

    beforeEach(() => {
        jest.clearAllMocks();
        passwordService = new PasswordService();
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
            // Mock bcrypt to throw a real error
            jest.mocked(bcrypt.hash).mockRejectedValueOnce(new Error('Bcrypt internal error') as never);

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
            const password = 'Test123!@';
            const hash = await passwordService['hashPassword'](password);
            const result = await passwordService['comparePassword'](password, hash);
            expect(result).toBe(true);
        });

        it('should return false for non-matching password', async () => {
            jest.mocked(bcrypt.compare).mockImplementationOnce(() => Promise.resolve(false));

            const hash = await passwordService['hashPassword']('Test123!@');
            const result = await passwordService['comparePassword']('Test123!#', hash);
            expect(result).toBe(false);
        });
    });
}); 