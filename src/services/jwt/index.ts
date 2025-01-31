import fs from 'fs';
import { sign, verify, JwtPayload, TokenExpiredError, SignOptions, VerifyOptions, JsonWebTokenError } from 'jsonwebtoken';
import { config } from '@gateway/config';
import { ApiError } from '@gateway/core/errors/api.error';
import { StatusCodes } from 'http-status-codes';
import { AccessTokenPayload, JtiDocument, RefreshTokenPayload } from './types';
import { IMongoConnection, mongoConnection } from '@gateway/utils/mongoConnection';

/**
 * Service for managing JWT tokens, including creation, verification, and blacklist management.
 */
export class JwtService {
    private publicKey: string;
    private privateKey: string;
    private readonly db: IMongoConnection;
    private readonly accessExpiration: string | number;
    private readonly refreshExpiration: string | number;
    private readonly verifyOptions = { algorithms: ['RS256'] };

    /**
     * Initializes the JWT service
     * @param {IMongoConnection} db - MongoDB connection instance
     * @throws {ApiError} When initialization fails
     */
    constructor(db: IMongoConnection = mongoConnection) {
        try {
            if (!db) {
                throw new Error('Database connection is required');
            }

            if (!config.jwtPublicKeyPath || !config.jwtPrivateKeyPath) {
                throw new Error('JWT key paths are required');
            }

            if (!config.jwtAccessExpiration || !config.jwtRefreshExpiration) {
                throw new Error('JWT expiration configuration is required');
            }

            this.publicKey = fs.readFileSync(config.jwtPublicKeyPath, 'utf8');
            this.privateKey = fs.readFileSync(config.jwtPrivateKeyPath, 'utf8');
            this.accessExpiration = config.jwtAccessExpiration;
            this.refreshExpiration = config.jwtRefreshExpiration;
            this.db = db;

            this.initialize().catch(error => {
                console.error('Failed to initialize TTL index:', error);
            });
        } catch (error) {
            console.error('JWT Service initialization error:', error);
            throw new ApiError('Failed to initialize JWT service', StatusCodes.INTERNAL_SERVER_ERROR, 'JWT Service Error');
        }
    }

    /**
     * Retrieves the JTI (Blacklist) collection from MongoDB.
     * @returns The JTI collection.
     */
    private jtiCollection() {
        return this.db.getClient().db().collection<JtiDocument>('jti');
    }

    /**
     * Initializes the TTL index on the 'expiresAt' field to automatically remove expired JTIs.
     */
    private async initializeJtiTTLIndex() {
        await this.runWithErrorHandling(async () => {
            const collection = this.jtiCollection();
            await collection.createIndex(
                { expiresAt: 1 },
                { expireAfterSeconds: 0, background: true }
            );
            console.debug('TTL index on "expiresAt" field has been ensured.');
        });
    }

    /**
     * Checks if a given JTI is present in the blacklist.
     * @param jti - The JTI to check.
     * @returns True if the JTI is blacklisted, false otherwise.
     */
    private async isJtiInBlackList(jti: string | undefined): Promise<boolean> {
        if (!jti) return false;
        return this.runWithErrorHandling(async () => {
            const jtiDoc = await this.jtiCollection().findOne({ _id: jti });
            return jtiDoc !== null;
        });
    }

    /**
     * Wraps asynchronous functions with centralized error handling.
     * @param fn - The asynchronous function to execute.
     * @returns The result of the asynchronous function.
     * @throws ApiError with status 500 if an error occurs.
     */
    private async runWithErrorHandling<T>(fn: () => Promise<T>): Promise<T> {
        try {
            return await fn();
        } catch (error: any) {
            throw new ApiError(error.message || 'JWT Service Error', StatusCodes.INTERNAL_SERVER_ERROR, 'JWT Service Error');
        }
    }

    private mapJwtError(error: unknown): never {
        if (error instanceof TokenExpiredError) {
            throw new ApiError('Token expired', StatusCodes.UNAUTHORIZED, 'Token expired');
        }
        if (error instanceof JsonWebTokenError) {
            throw new ApiError('Invalid token', StatusCodes.UNAUTHORIZED, 'Invalid token');
        }
        throw new ApiError('JWT Service Error', StatusCodes.INTERNAL_SERVER_ERROR, 'JWT Service Error');
    }

    /**
     * Validates the token payload
     * @private
     * @param {AccessTokenPayload} payload - The payload to validate
     * @throws {ApiError} When payload validation fails
     */
    private validatePayload(payload: AccessTokenPayload): void {
        if (!payload?.sub || typeof payload.sub !== 'string') {
            throw new ApiError('Invalid subject claim', StatusCodes.BAD_REQUEST, 'Invalid payload');
        }
        if (!payload?.role || typeof payload.role !== 'string') {
            throw new ApiError('Invalid role claim', StatusCodes.BAD_REQUEST, 'Invalid payload');
        }
    }

    /**
     * Generates a new JWT token
     * @param {AccessTokenPayload} payload - The payload to include in the token
     * @returns {string} The generated JWT token
     * @throws {ApiError} When token generation fails
     */
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

    /**
     * Generates a new refresh token
     * @param {RefreshTokenPayload} payload - The payload to include in the refresh token
     * @returns {string} The generated refresh token
     * @throws {ApiError} When token generation fails
     */
    public generateRefreshToken(payload: RefreshTokenPayload): string {
        try {
            const options = {
                algorithm: 'RS256' as const,
                ...(payload.exp ? {} : { expiresIn: this.refreshExpiration })
            };
            return sign(payload, this.privateKey, options as SignOptions);
        } catch (error) {
            this.mapJwtError(error);
        }
    }

    /**
     * Verifies a JWT token
     * @param {string} token - The token to verify
     * @returns {JwtPayload} The decoded token payload
     * @throws {ApiError} When token is invalid or expired
     */
    public verifyToken(token: string): JwtPayload {
        try {
            return verify(token, this.publicKey, this.verifyOptions as VerifyOptions) as JwtPayload;
        } catch (error) {
            this.mapJwtError(error);
        }
    }

    /**
     * Verifies a refresh token and checks if it's blacklisted.
     * @param {string} token - The refresh token to verify
     * @returns {Promise<JwtPayload>} The decoded token payload
     * @throws {ApiError} When token is invalid, expired, or blacklisted
     * 
     * @example
     * const payload = await jwtService.verifyRefreshToken('your.refresh.token');
     */
    public async verifyRefreshToken(token: string): Promise<JwtPayload> {
        let decoded: JwtPayload | null = null;
        try {
            decoded = verify(token, this.publicKey, this.verifyOptions as VerifyOptions) as JwtPayload;
            if (!decoded || typeof decoded === 'string') {
                throw new ApiError('Invalid refresh token', StatusCodes.UNAUTHORIZED, 'Invalid refresh token');
            }

            if (!decoded.jti) {
                throw new ApiError('Invalid refresh token: missing jti', StatusCodes.UNAUTHORIZED, 'Invalid refresh token');
            }
        } catch (error) {
            this.mapJwtError(error);
        }

        const blacklisted = await this.isJtiInBlackList(decoded.jti);
        if (blacklisted) {
            throw new ApiError('Refresh token revoked', StatusCodes.UNAUTHORIZED, 'Refresh token revoked');
        }
        return decoded;
    }

    /**
     * Retrieves all blacklisted JTIs.
     * @returns {Promise<JtiDocument[]>} Array of blacklisted JTI documents
     * @throws {ApiError} When database operation fails
     */
    public async getJtis(): Promise<JtiDocument[]> {
        return this.runWithErrorHandling(async () => {
            return await this.jtiCollection().find({}).toArray();
        });
    }

    /**
     * Adds a token's JTI to the blacklist.
     * @param {string} jti - The JWT ID to blacklist
     * @param {Date} expiresAt - When the token naturally expires
     * @returns {Promise<string>} The blacklisted JTI
     * @throws {ApiError} When JTI is invalid or operation fails
     * 
     * @example
     * const jti = await jwtService.saveJtiInBlackList('token-id', new Date('2024-12-31'));
     */
    public async saveJtiInBlackList(jti: string, expiresAt: Date): Promise<string> {
        if (!jti?.trim()) {
            throw new ApiError('Invalid JTI', StatusCodes.BAD_REQUEST, 'Invalid JTI');
        }
        if (!(expiresAt instanceof Date) || expiresAt < new Date()) {
            throw new ApiError('Invalid expiration date', StatusCodes.BAD_REQUEST, 'Invalid expiration date');
        }
        return this.runWithErrorHandling(async () => {
            await this.jtiCollection().insertOne({
                _id: jti,
                expiresAt,
                createdAt: new Date(),
                updatedAt: new Date(),
            } as JtiDocument);
            return jti;
        });
    }

    /**
     * Removes a JTI from the blacklist.
     * @param {string} jti - The JTI to remove
     * @returns {Promise<string>} The removed JTI
     * @throws {ApiError} When JTI is not found or operation fails
     * 
     * @example
     * const jti = await jwtService.deleteJtiFromBlackList('token-id');
     */
    public async deleteJtiFromBlackList(jti: string): Promise<string> {
        return this.runWithErrorHandling(async () => {
            const result = await this.jtiCollection().deleteOne({ _id: jti });
            if (result.deletedCount === 0) {
                throw new ApiError('Jti not found', StatusCodes.NOT_FOUND, 'Jti not found');
            }
            return jti;
        });
    }

    /**
     * Initializes the service by setting up required database indexes.
     * @returns {Promise<void>}
     * @throws {ApiError} When initialization fails
     */
    public async initialize(): Promise<void> {
        await this.initializeJtiTTLIndex();
    }
}
