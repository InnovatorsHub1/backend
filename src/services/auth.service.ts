import { injectable, inject } from 'inversify';
import { WinstonLogger } from '../core/logger/winston.logger';
import { ApiError } from '../core/errors/api.error';
import { GoogleUser } from '../types/auth.types';
import { UserRepository } from '../repositories/UserRepository';
import { TYPES } from '../core/di/types';

@injectable()
export class AuthService {
    private logger = new WinstonLogger('AuthService');

    constructor(
        @inject(TYPES.UserRepository) private userRepository: UserRepository
    ) {}

    async validateOrCreateUser(profile: any): Promise<GoogleUser> {
        try {
            this.logger.info('Processing Google profile', { profileId: profile.id });

            const user = await this.userRepository.upsertGoogleUser({
                googleId: profile.id,
                email: profile.emails[0].value,
                name: profile.displayName,
                picture: profile.photos?.[0]?.value
            });

            return {
                googleId: user.googleId,
                email: user.email,
                name: user.name,
                picture: user.picture
            };
        } catch (error) {
            this.logger.error('Google authentication failed', error);
            throw new ApiError('Authentication failed', 500, 'AuthService');
        }
    }

    async isUserAuthenticated(googleId: string): Promise<boolean> {
        const user = await this.userRepository.findByGoogleId(googleId);
        return !!(user && user.isActive);
    }
}