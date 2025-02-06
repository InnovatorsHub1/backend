import { injectable, inject } from 'inversify';
import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';

import { config } from '../config/index';
import { WinstonLogger } from '../core/logger/winston.logger';
import { ApiError } from '../core/errors/api.error';
import { GoogleUser } from '../types/auth.types';
import { UserRepository } from '../repositories/UserRepository';
import { TYPES } from '../core/di/types';

@injectable()
export class AuthService {
  private readonly logger = new WinstonLogger('AuthService');

  constructor(@inject(TYPES.UserRepository) private userRepository: UserRepository) { }

  async generateAuthUrl(): Promise<string> {
    this.logger.info('Attempting to generate auth url');
    try {
      const oAuth2Client = new OAuth2Client(
        config.googleClientID,
        config.googleClientSecret,
        config.googleCallbackURL,
      );

      const authorizeUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline', // make sure refresh token always sent.
        scope: 'https://www.googleapis.com/auth/userinfo.profile openid',
        prompt: 'conset',
      });
      this.logger.info('Generate an authorization url has been Successfully created');

      return authorizeUrl;
    } catch (error) {
      this.logger.error('Generate an authorization url failed');
      throw new ApiError('Generate an authorization url failed', 500, 'AuthService');
    }
  }

  async getUserData(accessToken: string): Promise<void> {
    this.logger.info('Getting User data');
    try {
      const { data } = await axios({
        method: 'GET',
        url: `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`,
      });

      console.log(data);

      return data;
    } catch (error) {
      this.logger.error('Fetch User data failed');
      throw new ApiError('Fetch User data failed', 500, 'AuthService');
    }

  }
}
