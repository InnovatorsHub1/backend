declare namespace Express {
  interface Request {
    id: string;
    deviceInfo: {
      userAgent?: string;
      ip?: string;
      platform?: string;
      browser?: string;
      version?: string;
      os?: string;
      device?: string;
      manufacturer?: string;
      model?: string;
      isBot?: boolean;
      isMobile?: boolean;
    };
  }

  interface CookieOptions {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'strict' | 'lax' | 'none';
  }
}