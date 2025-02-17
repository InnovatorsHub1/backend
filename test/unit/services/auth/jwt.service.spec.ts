import { JwtService } from '@gateway/services/jwt/jwt.service';
import { AccessTokenPayload, RefreshTokenPayload } from '@gateway/services/jwt/types';
import { sign, verify, JwtPayload } from 'jsonwebtoken';
import { getMongoConnection } from '@gateway/utils/mongoConnection';
import { ApiError } from '@gateway/core/errors/api.error';
import { StatusCodes } from 'http-status-codes';
import fs from 'fs';
import { generateKeyPairSync } from 'crypto';

jest.mock('fs');
jest.mock('@gateway/utils/mongoConnection', () => ({
    getMongoConnection: jest.fn().mockReturnValue({
        getClient: jest.fn().mockReturnValue({
            db: jest.fn().mockReturnValue({
                collection: jest.fn().mockReturnValue({
                    createIndex: jest.fn().mockResolvedValue('index created'),
                    findOne: jest.fn().mockResolvedValue(null),
                    insertOne: jest.fn().mockResolvedValue({ acknowledged: true }),
                    deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
                    countDocuments: jest.fn().mockResolvedValue(0)
                })
            })
        })
    })
}));

jest.mock('@gateway/config', () => ({
    config: {
        jwtPublicKeyPath: '/path/to/public.key',
        jwtPrivateKeyPath: '/path/to/private.key',
        jwtAccessExpiration: '1h',
        jwtRefreshExpiration: '7d'
    }
}));

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedMongoConnection = getMongoConnection() as jest.Mocked<any>;

describe('JwtService', () => {
    let jwtService: JwtService;
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    let mockCollection: any;
    let mockDb: any;

    beforeEach(() => {
        jest.resetAllMocks();

        mockedFs.readFileSync.mockImplementation((path: fs.PathOrFileDescriptor) => {
            if (path === '/path/to/public.key') return publicKey;
            if (path === '/path/to/private.key') return privateKey;
            return '';
        });

        mockCollection = {
            createIndex: jest.fn().mockResolvedValue('index created'),
            findOne: jest.fn().mockResolvedValue(null),
            insertOne: jest.fn().mockResolvedValue({ acknowledged: true }),
            deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
            countDocuments: jest.fn().mockResolvedValue(0)
        };

        mockDb = {
            collection: jest.fn().mockReturnValue(mockCollection)
        };

        mockedMongoConnection.getClient = jest.fn().mockReturnValue({
            db: () => mockDb
        });

        jwtService = new JwtService(mockedMongoConnection);
    });

    describe('Constructor and Initialization', () => {
        it('should initialize correctly with valid db connection', () => {
            expect(jwtService).toBeDefined();
            expect(mockedFs.readFileSync).toHaveBeenCalledWith('/path/to/public.key', 'utf8');
            expect(mockedFs.readFileSync).toHaveBeenCalledWith('/path/to/private.key', 'utf8');
        });
    });

    describe('generateToken', () => {
        it('should generate a valid access token with a proper payload', () => {
            const payload: AccessTokenPayload = { sub: 'user123', permissions: ['read'] };
            const token = jwtService.generateToken(payload);
            const decoded = verify(token, publicKey, { algorithms: ['RS256'] }) as JwtPayload;
            expect(decoded.sub).toEqual(payload.sub);
            expect(decoded.permissions).toEqual(payload.permissions);
        });

        it('should throw error when payload is invalid', () => {
            const invalidPayload = { permissions: ['read'] };
            expect(() => jwtService.generateToken(invalidPayload as any)).toThrow(ApiError);
        });
    });

    describe('generateRefreshToken', () => {
        it('should generate a valid refresh token and store it in the whitelist', async () => {
            const payload: RefreshTokenPayload = { sub: 'user123', permissions: ['read'] };
            const token = await jwtService.generateRefreshToken(payload);
            const decoded = verify(token, publicKey, { algorithms: ['RS256'] }) as JwtPayload;
            expect(decoded.sub).toEqual(payload.sub);
            expect(decoded.permissions).toEqual(payload.permissions);
            expect(decoded.jti).toBeDefined();
            expect(decoded.exp).toBeDefined();
            expect(mockCollection.insertOne).toHaveBeenCalled();
        });

        it('should throw error if maximum concurrent sessions reached', async () => {
            const error = new ApiError("Maximum concurrent sessions exceeded", StatusCodes.UNAUTHORIZED, "JwtService");
            mockCollection.countDocuments.mockResolvedValue(jwtService['MAX_CONCURRENT_SESSIONS']);
            const payload: RefreshTokenPayload = { sub: 'user123', permissions: ['read'] };
            await expect(jwtService.generateRefreshToken(payload))
                .rejects.toEqual(error);
        });
    });

    describe('verifyToken', () => {
        it('should return correct payload if token is valid', () => {
            const payload: AccessTokenPayload = { sub: 'user123', permissions: ['read'] };
            const token = sign(payload, privateKey, { algorithm: 'RS256', expiresIn: '1h' });
            const decoded = jwtService.verifyToken(token);
            expect(decoded.sub).toEqual(payload.sub);
            expect(decoded.permissions).toEqual(payload.permissions);
        });

        it('should throw error if token is invalid', () => {
            expect(() => jwtService.verifyToken('invalid.token')).toThrow(ApiError);
        });

        it('should throw error if token is expired', () => {
            const pastTimestamp = Math.floor(Date.now() / 1000) - 10000;
            const payload: AccessTokenPayload = { sub: 'user123', permissions: ['read'] };
            const token = sign({ ...payload, exp: pastTimestamp }, privateKey, { algorithm: 'RS256' });
            expect(() => jwtService.verifyToken(token)).toThrow(ApiError);
        });
    });

    describe('verifyRefreshToken', () => {
        it('should return payload if refresh token is valid and in whitelist', async () => {
            const payload: RefreshTokenPayload = { sub: 'user123', permissions: ['read'] };
            mockCollection.findOne.mockResolvedValueOnce({ _id: 'test-jti' });
            const token = sign({ ...payload, jti: 'test-jti' }, privateKey, { algorithm: 'RS256', expiresIn: '7d' });
            const decoded = await jwtService.verifyRefreshToken(token);
            expect(decoded.sub).toEqual(payload.sub);
        });

        it('should throw error if token does not contain jti', async () => {
            const payload = { sub: 'user123', permissions: ['read'], exp: Math.floor(Date.now() / 1000) + 3600 };
            const token = sign(payload, privateKey, { algorithm: 'RS256' });
            await expect(jwtService.verifyRefreshToken(token)).rejects.toThrow(ApiError);
        });

        it('should throw error if refresh token is not found in whitelist', async () => {
            const error = new ApiError("Invalid refresh token", StatusCodes.UNAUTHORIZED, "JwtService");
            mockCollection.findOne.mockResolvedValueOnce(null);
            const payload: RefreshTokenPayload = { sub: 'user123', permissions: ['read'] };
            const token = sign({ ...payload, jti: 'nonexistent' }, privateKey, { algorithm: 'RS256', expiresIn: '7d' });
            await expect(jwtService.verifyRefreshToken(token))
                .rejects.toEqual(error);
        });

        it('should throw error if refresh token is expired', async () => {
            const pastTimestamp = Math.floor(Date.now() / 1000) - 10;
            const payload: RefreshTokenPayload = { sub: 'user123', permissions: ['read'] };
            const token = sign({ ...payload, jti: 'test-jti', exp: pastTimestamp }, privateKey, { algorithm: 'RS256' });
            await expect(jwtService.verifyRefreshToken(token)).rejects.toThrow(ApiError);
        });
    });

    describe('refreshTokens', () => {
        it('should refresh access and refresh tokens if refresh token is valid', async () => {
            const payload: RefreshTokenPayload = { sub: 'user123', permissions: ['read'] };
            mockCollection.findOne.mockResolvedValue({ _id: 'test-jti' });
            mockCollection.deleteOne.mockResolvedValue({ deletedCount: 1 });
            const token = sign({ ...payload, jti: 'test-jti' }, privateKey, { algorithm: 'RS256', expiresIn: '7d' });
            const tokens = await jwtService.refreshTokens(token);
            expect(tokens).toHaveProperty('accessToken');
            expect(tokens).toHaveProperty('refreshToken');
            const decodedAccess = verify(tokens.accessToken, publicKey, { algorithms: ['RS256'] }) as JwtPayload;
            expect(decodedAccess.sub).toEqual(payload.sub);
        });
    });

    describe('revokeToken', () => {
        it('should successfully revoke token if found in whitelist', async () => {
            mockCollection.findOne.mockResolvedValue({ _id: 'test-jti' });
            mockCollection.deleteOne.mockResolvedValue({ deletedCount: 1 });
            const payload: RefreshTokenPayload = { sub: 'user123', permissions: ['read'] };
            const token = sign({ ...payload, jti: 'test-jti' }, privateKey, { algorithm: 'RS256', expiresIn: '7d' });
            await expect(jwtService.revokeToken(token)).resolves.not.toThrow();
        });

        it('should throw error if token is not found during revoke', async () => {
            const error = new ApiError("Token not found", StatusCodes.NOT_FOUND, "JwtService");
            mockCollection.findOne.mockResolvedValue({ _id: 'test-jti' });
            mockCollection.deleteOne.mockResolvedValue({ deletedCount: 0 });
            const payload: RefreshTokenPayload = { sub: 'user123', permissions: ['read'] };
            const token = sign({ ...payload, jti: 'test-jti' }, privateKey, { algorithm: 'RS256', expiresIn: '7d' });
            await expect(jwtService.revokeToken(token))
                .rejects.toEqual(error);
        });
    });

    describe('parseExpiration', () => {
        it('should correctly parse numeric expiration', () => {
            const result = jwtService['parseExpiration'](5);
            expect(result).toBe(5 * 1000);
        });

        it('should correctly parse string expiration (seconds)', () => {
            const result = jwtService['parseExpiration']('30s');
            expect(result).toBe(30000);
        });

        it('should correctly parse string expiration (minutes)', () => {
            const result = jwtService['parseExpiration']('2m');
            expect(result).toBe(2 * 60 * 1000);
        });

        it('should correctly parse string expiration (hours)', () => {
            const result = jwtService['parseExpiration']('1h');
            expect(result).toBe(3600 * 1000);
        });

        it('should correctly parse string expiration (days)', () => {
            const result = jwtService['parseExpiration']('1d');
            expect(result).toBe(24 * 3600 * 1000);
        });

        it('should throw error for invalid expiration format', () => {
            expect(() => jwtService['parseExpiration']('invalid')).toThrow();
        });
    });

    describe('validatePayload', () => {
        it('should throw error if subject is missing', () => {
            expect(() => jwtService['validatePayload']({ permissions: ['read'] } as any))
                .toThrow(ApiError);
        });

        it('should throw error if permissions is missing', () => {
            expect(() => jwtService['validatePayload']({ sub: 'user123' } as any))
                .toThrow(ApiError);
        });

        it('should pass for valid payload', () => {
            const payload: AccessTokenPayload = { sub: 'user123', permissions: ['read'] };
            expect(() => jwtService['validatePayload'](payload)).not.toThrow();
        });
    });

    describe('validateConcurrentSessions', () => {
        const error = new ApiError("Maximum concurrent sessions exceeded", StatusCodes.UNAUTHORIZED, "JwtService");
        it('should throw error if active sessions equal or exceed the limit', async () => {
            mockCollection.countDocuments.mockResolvedValue(jwtService['MAX_CONCURRENT_SESSIONS']);
            await expect(jwtService['validateConcurrentSessions']('user123'))
                .rejects.toEqual(error);
        });

        it('should resolve if active sessions are below the limit', async () => {
            mockCollection.countDocuments.mockResolvedValue(jwtService['MAX_CONCURRENT_SESSIONS'] - 1);
            await expect(jwtService['validateConcurrentSessions']('user123')).resolves.not.toThrow();
        });
    });

    describe('runWithErrorHandling', () => {
        it('should return result when the function passes', async () => {
            const result = await jwtService.runWithErrorHandling(async () => "success");
            expect(result).toEqual("success");
        });

        it('should propagate ApiError if the function throws one', async () => {
            const error = new ApiError("Test error", StatusCodes.BAD_REQUEST, "JwtService");
            await expect(jwtService.runWithErrorHandling(async () => { throw error; }))
                .rejects.toEqual(error);
        });

        it('should wrap non-ApiError errors', async () => {
            const error = new ApiError("JWT Service Error", StatusCodes.INTERNAL_SERVER_ERROR, "JwtService");
            const nativeError = new Error("Simple error");
            await expect(jwtService.runWithErrorHandling(async () => { throw nativeError; }))
                .rejects.toEqual(error);
        });
    });
});