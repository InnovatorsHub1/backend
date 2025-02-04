import { type BaseDocument } from "@gateway/repositories/BaseRepository";

export type RefreshTokenPayload = {
    sub: string;
    role: string;
    exp: number;
    jti: string;
};

export type AccessTokenPayload = Omit<RefreshTokenPayload, 'jti'>;

export interface JtiDocument extends BaseDocument {
    Jti: string;
    expiresAt: Date;
}


