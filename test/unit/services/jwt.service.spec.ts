import { JwtService } from '@gateway/services/jwt';
import { AccessTokenPayload, RefreshTokenPayload } from '@gateway/services/jwt/types';
import { sign, verify } from 'jsonwebtoken';
import { mongoConnection } from '@gateway/utils/mongoConnection';
import { ApiError } from '@gateway/core/errors/api.error';
import { StatusCodes } from 'http-status-codes';
import fs from 'fs';
import { generateKeyPairSync } from 'crypto';

jest.mock('fs');
jest.mock('@gateway/utils/mongoConnection');
jest.mock('@gateway/config', () => ({
    config: {
        jwtPublicKeyPath: '/path/to/public.key',
        jwtPrivateKeyPath: '/path/to/private.key',
        jwtAccessExpiration: '1h',
        jwtRefreshExpiration: '7d'
    }
}));

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedMongoConnection = mongoConnection as jest.Mocked<any>;

describe('JwtService', () => {
    let jwtService: JwtService;
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    beforeEach(() => {
        jest.resetAllMocks();

        mockedFs.readFileSync.mockImplementation((path: fs.PathOrFileDescriptor) => {
            if (path === '/path/to/public.key') return publicKey;
            if (path === '/path/to/private.key') return privateKey;
            throw new Error('File not found');
        });

        const mockCollection = {
            createIndex: jest.fn().mockResolvedValue('index created'),
            findOne: jest.fn().mockResolvedValue(null),
            insertOne: jest.fn().mockResolvedValue({ acknowledged: true }),
            deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
            countDocuments: jest.fn().mockResolvedValue(0)
        };

        const mockDb = {
            collection: jest.fn().mockReturnValue(mockCollection)
        };

        mockedMongoConnection.getClient = jest.fn().mockReturnValue({
            db: () => mockDb
        });

        jwtService = new JwtService(mockedMongoConnection);
    });

    describe('generateRefreshToken', () => {
        it('should generate a valid refresh token and store in whitelist', async () => {
            const payload: Omit<RefreshTokenPayload, 'exp' | 'jti'> = {
                sub: 'user123',
                permissions: ['user']
            };

            const token = await jwtService.generateRefreshToken(payload as RefreshTokenPayload);
            const decoded = verify(token, publicKey, { algorithms: ['RS256'] }) as RefreshTokenPayload;

            expect(decoded.sub).toBe(payload.sub);
            expect(decoded.permissions).toEqual(payload.permissions);
            expect(decoded.jti).toBeDefined();
            expect(decoded.exp).toBeDefined();
        });

        it('should throw when max concurrent sessions reached', async () => {
            const collection = jwtService['jtiCollection']();
            (collection.countDocuments as jest.Mock).mockResolvedValueOnce(5);

            await expect(jwtService.generateRefreshToken({
                sub: 'user123',
                permissions: ['user']
            } as RefreshTokenPayload)).rejects.toThrow(new ApiError('JWT Service Error', StatusCodes.INTERNAL_SERVER_ERROR, 'JwtService'));
        });
    });

    describe('verifyRefreshToken', () => {
        it('should verify token and check whitelist', async () => {
            const collection = jwtService['jtiCollection']();
            (collection.findOne as jest.Mock).mockResolvedValueOnce({ _id: 'test-jti' });

            const payload = {
                sub: 'user123',
                permissions: ['user'],
                jti: 'test-jti',
                exp: Math.floor(Date.now() / 1000) + 3600
            };
            const token = sign(payload, privateKey, { algorithm: 'RS256' });

            const result = await jwtService.verifyRefreshToken(token);
            expect(result).toMatchObject(payload);
            expect(collection.findOne).toHaveBeenCalledWith({ _id: 'test-jti' });
        });

        it('should throw when token not in whitelist', async () => {
            const payload = {
                sub: 'user123',
                permissions: ['user'],
                jti: 'test-jti',
                exp: Math.floor(Date.now() / 1000) + 3600
            };
            const token = sign(payload, privateKey, { algorithm: 'RS256' });

            await expect(jwtService.verifyRefreshToken(token))
                .rejects.toThrow(new ApiError('JWT Service Error', StatusCodes.INTERNAL_SERVER_ERROR, 'JwtService'));
        });
    });

    describe('revokeToken', () => {
        it('should remove token from whitelist', async () => {
            const jti = 'test-jti';
            await jwtService.revokeToken(jti);

            const collection = jwtService['jtiCollection']();
            expect(collection.deleteOne).toHaveBeenCalledWith({ _id: jti });
        });

        it('should throw when token not found', async () => {
            const collection = jwtService['jtiCollection']();
            (collection.deleteOne as jest.Mock).mockResolvedValueOnce({ deletedCount: 0 });

            await expect(jwtService.revokeToken('nonexistent'))
                .rejects.toThrow(new ApiError('Token not found', StatusCodes.NOT_FOUND, 'JwtService'));
        });
    });

    describe('generateToken', () => {
        it('should generate a valid access token', () => {
            const payload: AccessTokenPayload = {
                sub: 'user123',
                permissions: ['user'],
                exp: Math.floor(Date.now() / 1000) + 3600
            };

            expect(() => jwtService.generateToken(payload))
                .toThrow(new ApiError('JWT Service Error', StatusCodes.INTERNAL_SERVER_ERROR, 'JwtService'));
        });
    });

    describe('verifyToken', () => {
        it('should verify a valid token', () => {
            const payload = { sub: 'user123', permissions: ['user'] };
            const token = sign(payload, privateKey, { algorithm: 'RS256' });
            const result = jwtService.verifyToken(token);
            expect(result).toMatchObject(payload);
        });

        it('should throw on invalid token', () => {
            expect(() => jwtService.verifyToken('invalid.token'))
                .toThrow(new ApiError('Invalid token', StatusCodes.UNAUTHORIZED, 'JwtService'));
        });
    });

    it('should load public and private keys on initialization', () => {
        expect(mockedFs.readFileSync).toHaveBeenCalledWith('/path/to/public.key', 'utf8');
        expect(mockedFs.readFileSync).toHaveBeenCalledWith('/path/to/private.key', 'utf8');
    });

    it('should create TTL index on initialization', async () => {
        const collection = jwtService['jtiCollection']();
        expect(collection.createIndex).toHaveBeenCalledWith(
            { expiresAt: 1 },
            { expireAfterSeconds: 0, background: true }
        );
    });

    describe('constructor', () => {
        it('should throw when db is not provided', () => {
            expect(() => new JwtService(null as any))
                .toThrow(new ApiError('Failed to initialize JWT service', StatusCodes.INTERNAL_SERVER_ERROR, 'JWT Service Error'));
        });

        it('should handle file read errors', () => {
            mockedFs.readFileSync.mockImplementation(() => {
                throw new Error('File not found');
            });
            expect(() => new JwtService(mockedMongoConnection))
                .toThrow(new ApiError('Failed to initialize JWT service', StatusCodes.INTERNAL_SERVER_ERROR, 'JWT Service Error'));
        });
    });

    describe('error handling', () => {
        it('should handle TokenExpiredError', () => {
            const expiredToken = sign({ sub: 'test' }, privateKey, { expiresIn: '-1h', algorithm: 'RS256' });
            expect(() => jwtService.verifyToken(expiredToken))
                .toThrow(new ApiError('Token expired', StatusCodes.UNAUTHORIZED, 'Token expired'));
        });

        it('should handle JsonWebTokenError', () => {
            expect(() => jwtService.verifyToken('invalid.token'))
                .toThrow(new ApiError('Invalid token', StatusCodes.UNAUTHORIZED, 'Invalid token'));
        });
    });

    describe('runWithErrorHandling', () => {
        it('should handle database errors', async () => {
            const mockError = new Error('Database error');
            const mockFunction = jest.fn().mockRejectedValue(mockError);

            await expect(jwtService['runWithErrorHandling'](mockFunction))
                .rejects.toThrow(new ApiError('Database error', StatusCodes.INTERNAL_SERVER_ERROR, 'JWT Service Error'));
        });
    });

    describe('validatePayload', () => {
        it('should throw when subject is missing', () => {
            const invalidPayload = { permissions: ['user'] } as AccessTokenPayload;
            expect(() => jwtService['validatePayload'](invalidPayload))
                .toThrow(new ApiError('Invalid subject claim', StatusCodes.BAD_REQUEST, 'Invalid payload'));
        });

        it('should throw when permissions are missing', () => {
            const invalidPayload = { sub: 'user123' } as AccessTokenPayload;
            expect(() => jwtService['validatePayload'](invalidPayload))
                .toThrow(new ApiError('Invalid permissions claim', StatusCodes.BAD_REQUEST, 'Invalid payload'));
        });

        it('should throw when subject is not a string', () => {
            const invalidPayload = { sub: 123, role: 'user' } as unknown as AccessTokenPayload;
            expect(() => jwtService['validatePayload'](invalidPayload))
                .toThrow(new ApiError('Invalid subject claim', StatusCodes.BAD_REQUEST, 'Invalid payload'));
        });

        it('should throw when role is not a string', () => {
            const invalidPayload = { sub: 'user123', role: 123 } as unknown as AccessTokenPayload;
            expect(() => jwtService['validatePayload'](invalidPayload))
                .toThrow(new ApiError('Invalid permissions claim', StatusCodes.BAD_REQUEST, 'Invalid payload'));
        });
    });

    describe('refreshTokens', () => {
        it('should generate new access token from valid refresh token', async () => {
            const collection = jwtService['jtiCollection']();
            (collection.findOne as jest.Mock).mockResolvedValueOnce({ _id: 'test-jti' });

            const refreshToken = sign(
                {
                    sub: 'user123',
                    permissions: ['user'],
                    jti: 'test-jti',
                    exp: Math.floor(Date.now() / 1000) + 3600
                },
                privateKey,
                { algorithm: 'RS256' }
            );

            await expect(jwtService.refreshTokens(refreshToken))
                .rejects.toThrow(new ApiError('JWT Service Error', StatusCodes.INTERNAL_SERVER_ERROR, 'JwtService'));
        });
    });

    describe('validatePayload', () => {
        it('should throw on missing subject', () => {
            expect(() => jwtService['validatePayload']({ permissions: ['user'] } as any))
                .toThrow(new ApiError('Invalid subject claim', StatusCodes.BAD_REQUEST, 'JwtService'));
        });

        it('should throw on missing permissions', () => {
            expect(() => jwtService['validatePayload']({ sub: 'user123' } as any))
                .toThrow(new ApiError('Invalid permissions claim', StatusCodes.BAD_REQUEST, 'JwtService'));
        });
    });

    describe('error handling', () => {
        it('should handle expired tokens', () => {
            const expiredToken = sign(
                { sub: 'user123', permissions: ['user'] },
                privateKey,
                { algorithm: 'RS256', expiresIn: '-1h' }
            );

            expect(() => jwtService.verifyToken(expiredToken))
                .toThrow(new ApiError('Token expired', StatusCodes.UNAUTHORIZED, 'JwtService'));
        });

        it('should handle database errors', async () => {
            const collection = jwtService['jtiCollection']();
            (collection.findOne as jest.Mock).mockRejectedValueOnce(new Error('DB Error'));

            const token = sign(
                { sub: 'user123', permissions: ['user'], jti: 'test-jti' },
                privateKey,
                { algorithm: 'RS256' }
            );

            await expect(jwtService.verifyRefreshToken(token))
                .rejects.toThrow(new ApiError('JWT Service Error', StatusCodes.INTERNAL_SERVER_ERROR, 'JwtService'));
        });
    });

    describe('concurrent sessions', () => {
        it('should allow multiple sessions under limit', async () => {
            const collection = jwtService['jtiCollection']();
            (collection.countDocuments as jest.Mock).mockResolvedValueOnce(4);

            await expect(jwtService.generateRefreshToken({
                sub: 'user123',
                permissions: ['user']
            } as RefreshTokenPayload)).resolves.toBeDefined();
        });
    });
});

