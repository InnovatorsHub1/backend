import { sign, verify, JwtPayload, TokenExpiredError, SignOptions, VerifyOptions, JsonWebTokenError } from 'jsonwebtoken';
import fs from 'fs';
import { config } from '@gateway/config';
import { ApiError } from '@gateway/core/errors/api.error';
import { StatusCodes } from 'http-status-codes';
import { AccessTokenPayload, JtiDocument, RefreshTokenPayload } from './types';
import { IMongoConnection, getMongoConnection } from '@gateway/utils/mongoConnection';
import { randomUUID } from 'crypto';
import { injectable, optional, unmanaged } from 'inversify';


/**
 * Service for handling JWT tokens with refresh token support
 */
@injectable()
export class JwtService {
    private publicKey!: string;
    private privateKey!: string;
    private accessExpiration!: string | number;
    private refreshExpiration!: string | number;
    private readonly db: IMongoConnection;
    private readonly verifyOptions = { algorithms: ['RS256'] };
    private readonly MAX_CONCURRENT_SESSIONS = 5;

    constructor(@optional() @unmanaged() db?: IMongoConnection) {
        this.db = db || getMongoConnection();
        this.initializeService();
    }

    private initializeService(): void {
        try {
            this.validateDependencies();

            this.publicKey = fs.readFileSync(config.jwtPublicKeyPath!, 'utf8');
            this.privateKey = fs.readFileSync(config.jwtPrivateKeyPath!, 'utf8');
            this.accessExpiration = config.jwtAccessExpiration;
            this.refreshExpiration = config.jwtRefreshExpiration;

            this.initialize().catch(error => {
                console.error('Failed to initialize TTL index:', error);
            });
        } catch (error) {
            console.error('JWT Service initialization error:', error);
            throw new ApiError('Failed to initialize JWT service', StatusCodes.INTERNAL_SERVER_ERROR, 'JWT Service Error');
        }
    }

    private validateDependencies(): void {
        if (!this.db) throw new ApiError('Failed to initialize JWT service', StatusCodes.INTERNAL_SERVER_ERROR, 'JWT Service Error');
        if (!config.jwtPublicKeyPath || !config.jwtPrivateKeyPath) {
            throw new ApiError('Failed to initialize JWT service', StatusCodes.INTERNAL_SERVER_ERROR, 'JWT Service Error');
        }
        if (!config.jwtAccessExpiration || !config.jwtRefreshExpiration) {
            throw new ApiError('Failed to initialize JWT service', StatusCodes.INTERNAL_SERVER_ERROR, 'JWT Service Error');
        }
    }

    private jtiCollection() {
        return this.db.getClient().db().collection<JtiDocument>('jti');
    }

    private async initializeJtiTTLIndex() {
        try {
            const collection = this.jtiCollection();
            await collection.createIndex(
                { expiresAt: 1 },
                { expireAfterSeconds: 0, background: true }
            );
        } catch (error) {
            console.error('Failed to initialize TTL index:', error);
            throw new ApiError('Failed to initialize JWT service', StatusCodes.INTERNAL_SERVER_ERROR, 'JWT Service Error');
        }
    }

    async runWithErrorHandling<T>(fn: () => Promise<T>): Promise<T> {
        try {
            return await fn();
        } catch (error: any) {
            this.mapJwtError(error);
        }
    }

    private mapJwtError(error: unknown): never {
        if (error instanceof ApiError) {
            throw error;
        }
        if (error instanceof TokenExpiredError) {
            throw new ApiError('Token expired', StatusCodes.UNAUTHORIZED, 'JwtService');
        }
        if (error instanceof JsonWebTokenError) {
            throw new ApiError('Invalid token', StatusCodes.UNAUTHORIZED, 'JwtService');
        }
        throw new ApiError('JWT Service Error', StatusCodes.INTERNAL_SERVER_ERROR, 'JwtService');
    }

    private validatePayload(payload: AccessTokenPayload): void {
        if (!payload?.sub || typeof payload.sub !== 'string') {
            throw new ApiError('Invalid subject claim', StatusCodes.BAD_REQUEST, 'JwtService');
        }
        if (!payload?.permissions || !Array.isArray(payload.permissions)) {
            throw new ApiError('Invalid permissions claim', StatusCodes.BAD_REQUEST, 'JwtService');
        }
    }

    private parseExpiration(exp: string | number): number {
        if (typeof exp === 'number') return exp * 1000;

        const match = exp.match(/^(\d+)([dhms])$/);
        if (!match) throw new Error('Invalid expiration format');

        const [, value, unit] = match;
        const multipliers: Record<string, number> = {
            's': 1,
            'm': 60,
            'h': 60 * 60,
            'd': 24 * 60 * 60
        };

        return Number(value) * multipliers[unit] * 1000;
    }

    private async validateConcurrentSessions(userId: string): Promise<void> {
        const collection = this.jtiCollection();
        const activeSessions = await collection.countDocuments({
            isDeleted: false,
            expiresAt: { $gt: new Date() },
            userId: userId
        });

        if (activeSessions >= this.MAX_CONCURRENT_SESSIONS) {
            throw new ApiError('Maximum concurrent sessions exceeded', StatusCodes.UNAUTHORIZED, 'JwtService');
        }
    }

    public generateToken(payload: AccessTokenPayload): string {
        this.validatePayload(payload);
        try {
            const token = sign(payload, this.privateKey, {
                algorithm: 'RS256',
                expiresIn: this.accessExpiration
            } as SignOptions);

            return token;
        } catch (error) {
            this.mapJwtError(error);
        }
    }

    public async generateRefreshToken(payload: RefreshTokenPayload): Promise<string> {
        try {
            await this.validateConcurrentSessions(payload.sub);
            const jti = randomUUID();

            const token = sign(
                { ...payload, jti },
                this.privateKey,
                {
                    algorithm: 'RS256',
                    expiresIn: this.refreshExpiration
                } as SignOptions
            );

            await this.jtiCollection().insertOne({
                _id: jti,
                Jti: jti,
                userId: payload.sub,
                expiresAt: new Date(Date.now() + this.parseExpiration(this.refreshExpiration)),
                isDeleted: false,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            return token;
        } catch (error) {
            this.mapJwtError(error);
        }
    }

    public verifyToken(token: string): JwtPayload {
        try {
            return verify(token, this.publicKey, this.verifyOptions as VerifyOptions) as JwtPayload;
        } catch (error) {
            this.mapJwtError(error);
        }
    }

    public async verifyRefreshToken(token: string): Promise<JwtPayload> {
        try {
            const decoded = verify(token, this.publicKey, this.verifyOptions as VerifyOptions) as JwtPayload;

            if (!decoded || typeof decoded === 'string') {
                throw new ApiError('Invalid refresh token', StatusCodes.UNAUTHORIZED, 'JwtService');
            }

            if (!decoded.jti) {
                throw new ApiError('Invalid refresh token: missing jti', StatusCodes.UNAUTHORIZED, 'JwtService');
            }

            const isValid = await this.jtiCollection().findOne({ _id: decoded.jti });

            if (!isValid) {
                throw new ApiError('Invalid refresh token', StatusCodes.UNAUTHORIZED, 'JwtService');
            }
            return decoded;
        } catch (error) {
            this.mapJwtError(error);
        }
    }

    public async refreshTokens(refreshToken: string): Promise<{ accessToken: string, refreshToken: string }> {
        const decoded = await this.verifyRefreshToken(refreshToken);
        const accessToken = this.generateToken({
            sub: decoded.sub!,
            permissions: decoded.permissions,
        });
        const newRefreshToken = await this.generateRefreshToken({
            sub: decoded.sub!,
            permissions: decoded.permissions,
        });
        await this.revokeToken(refreshToken);

        return { accessToken, refreshToken: newRefreshToken };
    }

    public async revokeToken(refreshToken: string): Promise<void> {
        return this.runWithErrorHandling(async () => {
            const payload = await this.verifyRefreshToken(refreshToken);
            const result = await this.jtiCollection().deleteOne({ _id: payload.jti! });
            if (result.deletedCount === 0) {
                throw new ApiError('Token not found', StatusCodes.NOT_FOUND, 'JwtService');
            }
        });
    }

    public async initialize(): Promise<void> {
        await this.initializeJtiTTLIndex();
    }
}