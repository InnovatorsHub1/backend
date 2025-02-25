import { BaseDocument } from '@gateway/repositories/BaseRepository';

interface IBaseUser extends BaseDocument {
    username: {
        type:string;
        required: true;
        minLength: 3;
        unique: true;
    };
    email: {
        type: string;
        required: true;
        unique: true;
    }
    failedLoginAttempts: number;
    lockUntil?: Date;
    lastLogin?: Date;
    lastActiveAt: Date;
    profile: {
        firstName?: string;
        lastName?: string;
        avatar?: string;
        phoneNumber?: string;
    };
    role: string;
    roleExp: Date;
    permissions: string[];
    isActive: boolean;
}

export interface ICredentialsUser extends IBaseUser {
    isEmailVerified: boolean;
    password: string;
}

export interface ISSOUser extends IBaseUser {
    provider: 'google' | 'facebook' | 'saml' | 'local';
    providerId: string;
    accessToken?: string;
}

export type IUser = ICredentialsUser | ISSOUser; 