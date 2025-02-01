import 'express-session';
import { GoogleUser } from './auth.types';

declare module 'express-session' {
  interface Session {
    user: GoogleUser;
  }
}