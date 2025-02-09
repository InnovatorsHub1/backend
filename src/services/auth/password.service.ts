import * as bcrypt from 'bcrypt';
import { ApiError } from '@gateway/core/errors/api.error';
import { StatusCodes } from 'http-status-codes';
import { injectable } from 'inversify';
import { StandardValidators } from '@gateway/core/validation/validators';


@injectable()

export class PasswordService {
    private readonly SALT_ROUNDS = 10;


    async hashPassword(password: string): Promise<string> {
        this.validatePassword(password);
        return bcrypt.hash(password, this.SALT_ROUNDS);
    }

    async comparePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
        return bcrypt.compare(plainPassword, hashedPassword);
    }

    private validatePassword(password: string): void {
        const isValid = StandardValidators.password(password);
        if (!isValid) {
            throw new ApiError('Invalid password format', StatusCodes.BAD_REQUEST, 'PasswordService');
        }
    }



}