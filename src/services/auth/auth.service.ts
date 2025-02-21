import { injectable, inject } from 'inversify';
import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';

import { config } from '../../config/index';
import { WinstonLogger } from '../../core/logger/winston.logger';
import { ApiError } from '../../core/errors/api.error';
import { GoogleUser } from '../types/auth.types';
import { UserRepository } from '../../repositories/UserRepository';
import { TYPES } from '../../core/di/types';

@injectable()
export class AuthService {
  private readonly logger = new WinstonLogger('AuthService');
  private readonly oAuth2Client: OAuth2Client;

  constructor(@inject(TYPES.UserRepository) private readonly userRepository: UserRepository) {
    this.oAuth2Client = new OAuth2Client(
      config.googleClientID,
      config.googleClientSecret,
      config.googleCallbackURL,
    );
  }

  async generateAuthUrl(): Promise<string> {
    this.logger.info('Attempting to generate auth url');
    try {
      const authorizeUrl = this.oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['profile', 'email'],
        prompt: 'consent',
      });

      this.logger.info('Authorization URL generated successfully');

      return authorizeUrl;
    } catch (error) {
      this.logger.error('Failed to generate authorization URL', error);
      throw new ApiError('Failed to generate authorization URL', 500, 'AuthService');
    }
  }

  async getUserData(accessToken: string): Promise<GoogleUser> {
    this.logger.info('Getting user data from Google');
    try {
      const { data } = await axios({
        method: 'GET',
        url: `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`,
      });

      const googleUser: GoogleUser = {
        googleId: data.sub,
        email: data.email,
        name: data.name,
        picture: data.picture,
      };

      await this.userRepository.upsertGoogleUser(googleUser);

      return googleUser;
    } catch (error) {
      this.logger.error('Failed to fetch user data', error);
      throw new ApiError('Failed to fetch user data', 500, 'AuthService');
    }
  }

  async validateOrCreateUser(profile: { id: string }): Promise<GoogleUser | null> {
    try {
      return await this.userRepository.findByGoogleId(profile.id);
    } catch (error) {
      this.logger.error('Failed to validate user', error);
      throw new ApiError('Failed to validate user', 500, 'AuthService');
    }
  }
}