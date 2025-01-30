import fs from 'fs';
import { sign, verify, SignOptions, JwtPayload, VerifyOptions, TokenExpiredError } from 'jsonwebtoken';
import { config } from '@gateway/config';
import { ApiError } from '@gateway/core/errors/api.error';
import { StatusCodes } from 'http-status-codes';
import { AccessTokenPayload, JtiDocument, RefreshTokenPayload } from './types';
import { IMongoConnection, mongoConnection } from '@gateway/utils/mongoConnection';

/**
 * Service for managing JWT tokens, including creation, verification, and blacklist management.
 */
export class JwtService {
    private readonly publicKey: string;
    private readonly privateKey: string;
    private readonly accessExpiration: string | number;
    private readonly refreshExpiration: string | number;
    private readonly db: IMongoConnection;
    private readonly signRefreshTokenOptions: SignOptions;
    private readonly signAccessTokenOptions: SignOptions;
    private readonly verifyOptions: VerifyOptions;

    /**
     * Initializes the JwtService by loading keys, setting up sign and verify options,
     * and creating the TTL index for the blacklist.
     * Throws an error if keys cannot be loaded.
     */
    constructor() {
        try {
            this.publicKey = fs.readFileSync(config.jwtPublicKeyPath!, 'utf8');
            this.privateKey = fs.readFileSync(config.jwtPrivateKeyPath!, 'utf8');
        } catch (error) {
            this.errorException('Failed to load JWT keys', StatusCodes.INTERNAL_SERVER_ERROR);
        }

        this.accessExpiration = config.jwtAccessExpiration;
        this.refreshExpiration = config.jwtRefreshExpiration;
        this.db = mongoConnection;

        this.signAccessTokenOptions = {
            expiresIn: this.accessExpiration as number | `${number}d` | `${number}h` | `${number}m` | `${number}s`,
            algorithm: 'RS256',
        };

        this.signRefreshTokenOptions = {
            expiresIn: this.refreshExpiration as number | `${number}d` | `${number}h` | `${number}m` | `${number}s`,
            algorithm: 'RS256',
        };

        this.verifyOptions = {
            algorithms: ['RS256'],
        };

        // Initialize the TTL index for the JTI blacklist
        this.initializeJtiTTLIndex();
    }

    /**
     * Throws an ApiError with the given message and status code.
     * @param message - The error message.
     * @param statusCode - The HTTP status code.
     */
    private errorException(message: string, statusCode: StatusCodes): never {
        throw new ApiError(message, statusCode, 'JWT Service Error');
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
            this.errorException(error.message || 'JWT Service Error', StatusCodes.INTERNAL_SERVER_ERROR);
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
            // Create TTL index if it doesn't exist
            await collection.createIndex(
                { expiresAt: 1 },
                { expireAfterSeconds: 0, background: true }
            );
            console.log('TTL index on "expiresAt" field has been ensured.');
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
     * Generates an access token with the provided payload.
     * @param payload - The payload to include in the token.
     * @returns A signed JWT access token.
     */
    public generateToken(payload: AccessTokenPayload): string {
        return sign(payload, this.privateKey, this.signAccessTokenOptions);
    }

    /**
     * Generates a refresh token with the provided payload.
     * @param payload - The payload to include in the token.
     * @returns A signed JWT refresh token.
     */
    public generateRefreshToken(payload: RefreshTokenPayload): string {
        return sign(payload, this.privateKey, this.signRefreshTokenOptions);
    }

    /**
     * Verifies the validity of an access token.
     * @param token - The JWT access token to verify.
     * @returns The decoded JWT payload if valid.
     * @throws ApiError with status 401 if the token is invalid.
     */
    public verifyToken(token: string): JwtPayload {
        try {
            return verify(token, this.publicKey, this.verifyOptions) as JwtPayload;
        } catch (error) {
            this.errorException('Invalid token', StatusCodes.UNAUTHORIZED);
        }
    }

    /**
     * Verifies the validity of a refresh token and checks if it is blacklisted.
     * @param token - The JWT refresh token to verify.
     * @returns The decoded JWT payload if valid and not blacklisted.
     * @throws ApiError with status 401 if the token is invalid, expired, or blacklisted.
     */
    public async verifyRefreshToken(token: string): Promise<JwtPayload> {
        let decoded: JwtPayload | null = null;
        try {
            decoded = verify(token, this.publicKey, this.verifyOptions) as JwtPayload;
            if (!decoded || typeof decoded === 'string') {
                this.errorException('Invalid refresh token', StatusCodes.UNAUTHORIZED);
            }

            if (!decoded.jti) {
                this.errorException('Invalid refresh token: missing jti', StatusCodes.UNAUTHORIZED);
            }
        } catch (error: any) {
            if (error instanceof TokenExpiredError) {
                this.errorException('Refresh token expired', StatusCodes.UNAUTHORIZED);
            }
            if (error instanceof ApiError) throw error;
            this.errorException('Invalid refresh token', StatusCodes.UNAUTHORIZED);
        }

        const blacklisted = await this.isJtiInBlackList(decoded!.jti);
        if (blacklisted) {
            this.errorException('Refresh token revoked', StatusCodes.UNAUTHORIZED);
        }
        return decoded!;
    }

    /**
     * Retrieves all JTIs from the blacklist.
     * @returns An array of blacklisted JTIs.
     */
    public async getJtis(): Promise<JtiDocument[]> {
        return this.runWithErrorHandling(async () => {
            return await this.jtiCollection().find({}).toArray();
        });
    }

    /**
     * Adds a JTI to the blacklist.
     * @param jti - The JTI to blacklist.
     * @param expiresAt - The expiration date of the token associated with the JTI.
     * @returns The JTI that was added to the blacklist.
     */
    public async saveJtiInBlackList(jti: string, expiresAt: Date): Promise<string> {
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
     * @param jti - The JTI to remove from the blacklist.
     * @returns The JTI that was removed.
     * @throws ApiError with status 404 if the JTI is not found in the blacklist.
     */
    public async deleteJtiFromBlackList(jti: string): Promise<string> {
        return this.runWithErrorHandling(async () => {
            const result = await this.jtiCollection().deleteOne({ _id: jti });
            if (result.deletedCount === 0) {
                this.errorException('Jti not found', StatusCodes.NOT_FOUND);
            }
            return jti;
        });
    }
}

export const jwtService = new JwtService();
