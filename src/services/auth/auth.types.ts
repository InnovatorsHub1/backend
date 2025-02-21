export interface GoogleUser {
    googleId: string;
    email: string;
    name: string;
    picture?: string;
}

export interface AuthResponse {
    success: boolean;
    data?: {
        user: GoogleUser;
        redirectUrl: string;
    };
    error?: string;
}