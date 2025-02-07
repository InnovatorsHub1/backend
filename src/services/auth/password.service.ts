import * as bcrypt from 'bcrypt';
import { ApiError } from '@gateway/core/errors/api.error';
import { StatusCodes } from 'http-status-codes';
import { injectable } from 'inversify';

@injectable()
export class PasswordService {
    private readonly SALT_ROUNDS = 10;
    private readonly PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])[A-Za-z\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{8,}$/;

    async hashPassword(password: string): Promise<string> {
        this.validatePassword(password);
        return bcrypt.hash(password, this.SALT_ROUNDS);
    }

    async comparePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
        return bcrypt.compare(plainPassword, hashedPassword);
    }

    private validatePassword(password: string): void {
        if (!password || typeof password !== 'string') {
            throw new ApiError('Invalid password format', StatusCodes.BAD_REQUEST, 'PasswordService');
        }

        if (password.length < 8) {
            throw new ApiError('Password must be at least 8 characters long', StatusCodes.BAD_REQUEST, 'PasswordService');
        }

        if (!this.PASSWORD_PATTERN.test(password)) {
            throw new ApiError(
                'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
                StatusCodes.BAD_REQUEST,
                'PasswordService'
            );
        }
    }
}