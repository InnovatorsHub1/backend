import { type BaseDocument } from "@gateway/repositories/BaseRepository";

export interface RefreshTokenPayload {
    sub: string;
    permissions: string[];
    exp?: number;
    jti?: string;
}

export interface AccessTokenPayload {
    sub: string;
    deviceInfo?: any;
    permissions: string[];
}

export interface JtiDocument extends BaseDocument {
    Jti: string;
    expiresAt: Date;
    userId: string;
}


