import { injectable } from 'inversify';
import * as bcrypt from 'bcrypt';
import { ApiError } from '@gateway/core/errors/api.error';
import { StatusCodes } from 'http-status-codes';

@injectable()
export class PasswordService {
    private readonly SALT_ROUNDS = 12;
    private readonly PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

    private async runWithErrorHandling<T>(operation: () => Promise<T>, errorMessage: string): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            if (error instanceof Error && error.message.includes('invalid')) {
                throw new ApiError(errorMessage, StatusCodes.BAD_REQUEST, 'PasswordService');
            }
            throw new ApiError(errorMessage, StatusCodes.INTERNAL_SERVER_ERROR, 'PasswordService');
        }
    }

    async hashPassword(password: string): Promise<string> {
        this.validatePassword(password);
        return this.runWithErrorHandling(
            () => bcrypt.hash(password, this.SALT_ROUNDS),
            'Failed to hash password'
        );
    }

    async comparePassword(password: string, hash: string): Promise<boolean> {
        return this.runWithErrorHandling(
            () => bcrypt.compare(password, hash),
            'Failed to compare passwords'
        );
    }

    validatePassword(password: string): void {
        if (!this.PASSWORD_REGEX.test(password)) {
            throw new ApiError(
                'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number and one special character',
                StatusCodes.BAD_REQUEST,
                'PasswordService'
            );
        }
    }
}