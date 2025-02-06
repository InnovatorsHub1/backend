import { type BaseDocument } from "@gateway/repositories/BaseRepository";

export type RefreshTokenPayload = {
    sub: string;
    role: string;
    exp: number;
    jti: string;
};

export interface AccessTokenPayload {
    sub: string;
    deviceInfo?: any;
    role: string
    exp?: number;
}

export interface JtiDocument extends BaseDocument {
    Jti: string;
    expiresAt: Date;
}


