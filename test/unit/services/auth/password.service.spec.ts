// חשוב: יש לבצע את mock ל-bcrypt לפני כל import של קוד שמשתמש בו
jest.mock('bcrypt', () => ({
    hash: jest.fn(),
    compare: jest.fn(),
}));

import * as bcrypt from 'bcrypt';
import { PasswordService } from '@gateway/services/auth/password.service';
import { ApiError } from '@gateway/core/errors/api.error';
import { StatusCodes } from 'http-status-codes';

describe('PasswordService', () => {
    let passwordService: PasswordService;

    beforeEach(() => {
        passwordService = new PasswordService();

        // איפוס המוקים לפני כל טסט
        (bcrypt.hash as jest.Mock).mockReset();
        (bcrypt.compare as jest.Mock).mockReset();

        // הגדרת ערכים ברירת מחדל למוקים (ניתן לשנות בכל טסט בנפרד עם mockResolvedValueOnce / mockRejectedValueOnce)
        (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
        (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    });

    describe('validatePassword', () => {
        it('should accept valid password', () => {
            expect(() =>
                // גישה ישירה למתודה פרטית
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

            // bcrypt.hash מחזיר כבר בברירת מחדל 'hashedPassword'
            const hash = await passwordService.hashPassword(password);

            expect(hash).toBeTruthy();
            expect(hash).not.toBe(password);
            expect(typeof hash).toBe('string');
            expect(hash.length).toBeGreaterThan(0);
        });

        it('should throw ApiError when bcrypt fails', async () => {
            // גורמים ל-bcrypt.hash להיכשל הפעם
            (bcrypt.hash as jest.Mock).mockRejectedValueOnce(new Error('Bcrypt internal error'));

            await expect(passwordService.hashPassword('Test123!@'))
                .rejects
                .toThrow(ApiError);
        });

        it('should throw error for non-string password', async () => {
            // מוודאים שייווצר שגיאת ApiError כשהפרמטר לא סטרינג
            await expect(passwordService.hashPassword(123 as any))
                .rejects
                .toThrow(new ApiError('Invalid password format', StatusCodes.BAD_REQUEST, 'PasswordService'));
        });
    });

    describe('comparePassword', () => {
        it('should return true for matching password', async () => {
            // כאן אנו מחזירים פעם אחת true
            (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);

            const result = await passwordService.comparePassword('password123', 'hashedPassword');
            expect(result).toBe(true);
        });

        it('should return false for non-matching password', async () => {
            // כברירת מחדל הגדרנו false, אבל אפשר שוב לציין במפורש
            (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

            const result = await passwordService.comparePassword('wrongPassword', 'hashedPassword');
            expect(result).toBe(false);
        });
    });
});
