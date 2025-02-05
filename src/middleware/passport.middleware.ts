import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { TYPES } from '@gateway/core/di/types';

import { container } from '../core/di/container';
import { AuthService } from '../services/auth.service';
import { WinstonLogger } from '../core/logger/winston.logger';
// import { GoogleUser } from '../types/auth.types';

const logger = new WinstonLogger('PassportMiddleware');

export const setupPassport = () => {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: `${process.env.BASE_URL}/auth/google/callback`,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          logger.info('Google authentication callback received', {
            profileId: profile.id,
          });

          const authService = container.get<AuthService>(TYPES.AuthService);
          const user = await authService.validateOrCreateUser(profile);

          return done(null, user);
        } catch (error) {
          logger.error('Google strategy error', error);

          return done(error as Error, undefined);
        }
      },
    ),
  );

  // passport.serializeUser((user: GoogleUser, done) => {
  //   done(null, user.googleId);
  // });

  passport.deserializeUser(async (googleId: string, done) => {
    try {
      const authService = container.get<AuthService>(TYPES.AuthService);
      const user = await authService.validateOrCreateUser({ id: googleId });
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
};
