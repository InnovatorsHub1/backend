export const GOOGLE_CONFIG = {
  clientID: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  callbackURL: `${process.env.BASE_URL}/auth/google/callback`
};
