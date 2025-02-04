import { sign, verify, JwtPayload, TokenExpiredError, SignOptions, VerifyOptions, JsonWebTokenError } from 'jsonwebtoken';
import fs from 'fs';
import { config } from '@gateway/config';
import { ApiError } from '@gateway/core/errors/api.error';
import { StatusCodes } from 'http-status-codes';
import { AccessTokenPayload, JtiDocument, RefreshTokenPayload } from './types';
import { IMongoConnection, mongoConnection } from '@gateway/utils/mongoConnection';
import { randomUUID } from 'crypto';

/**
 * Service for handling JWT tokens with refresh token support
 */
export class JwtService {
    private publicKey!: string;
    private privateKey!: string;
    private accessExpiration!: string | number;
    private refreshExpiration!: string | number;
    private readonly db: IMongoConnection;
    private readonly verifyOptions = { algorithms: ['RS256'] };
    private readonly MAX_CONCURRENT_SESSIONS = 5;



    constructor(db: IMongoConnection = mongoConnection) {
        this.db = db;
        this.initializeService();
    }

    private initializeService(): void {
        try {
            this.validateDependencies();
            this.loadKeys();
            this.loadConfiguration();

            this.initialize().catch(error => {
                console.error('Failed to initialize TTL index:', error);
            });
        } catch (error) {
            console.error('JWT Service initialization error:', error);
            throw new ApiError('Failed to initialize JWT service', StatusCodes.INTERNAL_SERVER_ERROR, 'JwtService');
        }
    }

    private validateDependencies(): void {
        if (!this.db) throw new Error('Database connection is required');
        if (!config.jwtPublicKeyPath || !config.jwtPrivateKeyPath) {
            throw new Error('JWT key paths are required');
        }
        if (!config.jwtAccessExpiration || !config.jwtRefreshExpiration) {
            throw new Error('JWT expiration configuration is required');
        }
    }

    private loadKeys(): void {
        this.publicKey = fs.readFileSync(config.jwtPublicKeyPath!, 'utf8');
        this.privateKey = fs.readFileSync(config.jwtPrivateKeyPath!, 'utf8');
    }


    private loadConfiguration(): void {
        this.accessExpiration = config.jwtAccessExpiration;
        this.refreshExpiration = config.jwtRefreshExpiration;
    }

    private jtiCollection() {
        return this.db.getClient().db().collection<JtiDocument>('jti');
    }

    private async initializeJtiTTLIndex() {
        await this.runWithErrorHandling(async () => {
            const collection = this.jtiCollection();
            await collection.createIndex(
                { expiresAt: 1 },
                { expireAfterSeconds: 0, background: true }
            );
        });
    }

    private async runWithErrorHandling<T>(fn: () => Promise<T>): Promise<T> {
        try {
            return await fn();
        } catch (error: any) {
            throw new ApiError(error.message || 'JWT Service Error', StatusCodes.INTERNAL_SERVER_ERROR, 'JwtService');
        }
    }

    private mapJwtError(error: unknown): never {
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
        if (!payload?.role || typeof payload.role !== 'string') {
            throw new ApiError('Invalid role claim', StatusCodes.BAD_REQUEST, 'JwtService');
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
            expiresAt: { $gt: new Date() }
        });

        if (activeSessions >= this.MAX_CONCURRENT_SESSIONS) {
            throw new ApiError('Maximum concurrent sessions exceeded', StatusCodes.UNAUTHORIZED, 'JwtService');
        }
    }

    public generateToken(payload: AccessTokenPayload): string {
        this.validatePayload(payload);
        try {
            return sign(payload, this.privateKey, {
                algorithm: 'RS256',
                expiresIn: this.accessExpiration
            } as SignOptions);
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

    public async refreshTokens(refreshToken: string): Promise<string> {
        const decoded = await this.verifyRefreshToken(refreshToken);
        return this.generateToken({
            sub: decoded.sub!,
            role: decoded.role,
            exp: decoded.exp!
        });
    }

    public async revokeToken(jti: string): Promise<void> {
        return this.runWithErrorHandling(async () => {
            const result = await this.jtiCollection().deleteOne({ _id: jti });
            if (result.deletedCount === 0) {
                throw new ApiError('Token not found', StatusCodes.NOT_FOUND, 'JwtService');
            }
        });
    }

    public async initialize(): Promise<void> {
        await this.initializeJtiTTLIndex();
    }
}