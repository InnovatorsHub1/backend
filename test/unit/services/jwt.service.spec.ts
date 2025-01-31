import { JwtService } from '@gateway/services/jwt';
import { AccessTokenPayload, RefreshTokenPayload, JtiDocument } from '@gateway/services/jwt/types';
import { sign, verify } from 'jsonwebtoken';
import { mongoConnection } from '@gateway/utils/mongoConnection';
import { ApiError } from '@gateway/core/errors/api.error';
import { StatusCodes } from 'http-status-codes';
import fs from 'fs';
import { config } from '@gateway/config';
import { Collection } from 'mongodb';
import { generateKeyPairSync } from 'crypto';


jest.mock('fs');

jest.mock('@gateway/utils/mongoConnection');

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedMongoConnection = mongoConnection as jest.Mocked<any>;

jest.mock('@gateway/config', () => ({
    config: {
        jwtPublicKeyPath: './test/keys/public.key',
        jwtPrivateKeyPath: './test/keys/private.key',
        jwtAccessExpiration: '15m',
        jwtRefreshExpiration: '7d'
    }
}));

describe('JwtService', () => {
    let jwtService: JwtService;


    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
        }
    });

    beforeEach(() => {
        jest.resetAllMocks();


        mockedFs.readFileSync.mockImplementation((path: fs.PathOrFileDescriptor) => {
            if (path === config.jwtPublicKeyPath) return publicKey;
            if (path === config.jwtPrivateKeyPath) return privateKey;
            throw new Error('File not found');
        });


        const mockCollection = {
            createIndex: jest.fn().mockResolvedValue('index created'),
            findOne: jest.fn().mockResolvedValue(null),
            insertOne: jest.fn().mockResolvedValue({ acknowledged: true }),
            deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
            find: jest.fn().mockReturnValue({
                toArray: jest.fn().mockResolvedValue([])
            })
        };

        const mockDb = {
            collection: jest.fn().mockReturnValue(mockCollection)
        };

        mockedMongoConnection.db = mockDb;
        mockedMongoConnection.getClient = jest.fn().mockReturnValue({ db: () => mockDb });

        jwtService = new JwtService(mockedMongoConnection);
    });

    it('should load public and private keys on initialization', () => {
        expect(mockedFs.readFileSync).toHaveBeenCalledWith(config.jwtPublicKeyPath, 'utf8');
        expect(mockedFs.readFileSync).toHaveBeenCalledWith(config.jwtPrivateKeyPath, 'utf8');
    });

    it('should create TTL index on initialization', async () => {
        const collection = jwtService['jtiCollection']();
        expect(collection.createIndex).toHaveBeenCalledWith(
            { expiresAt: 1 },
            { expireAfterSeconds: 0, background: true }
        );
    });

    describe('generateToken', () => {
        it('should generate a valid access token', () => {
            const payload = {
                sub: 'user123',
                role: 'user'
            };

            const token = jwtService.generateToken(payload as AccessTokenPayload);
            const decoded = verify(token, jwtService['publicKey'], { algorithms: ['RS256'] }) as AccessTokenPayload;
            expect(decoded.sub).toBe(payload.sub);
            expect(decoded.role).toBe(payload.role);
        });
    });

    describe('verifyToken', () => {
        it('should verify a valid token', () => {
            const payload = { sub: 'user123', role: 'user' };
            const token = sign(payload, jwtService['privateKey'], { algorithm: 'RS256' });

            const result = jwtService.verifyToken(token);
            expect(result.sub).toBe(payload.sub);
            expect(result.role).toBe(payload.role);
        });

        it('should throw on invalid token', () => {
            expect(() => {
                jwtService.verifyToken('invalid.token');
            }).toThrow(ApiError);
            try {
                jwtService.verifyToken('invalid.token');
            } catch (error) {
                expect(error).toBeInstanceOf(ApiError);
                expect((error as ApiError).statusCode).toBe(StatusCodes.UNAUTHORIZED);
            }
        });
    });

    describe('generateRefreshToken', () => {
        it('should generate a valid refresh token', () => {
            const payload: RefreshTokenPayload = {
                sub: 'user123',
                role: 'user',
                jti: 'unique-id',
                exp: Math.floor(Date.now() / 1000) + 3600
            };

            const token = jwtService.generateRefreshToken(payload);
            const decoded = verify(token, jwtService['publicKey'], { algorithms: ['RS256'] }) as RefreshTokenPayload;
            expect(decoded.sub).toBe(payload.sub);
            expect(decoded.role).toBe(payload.role);
            expect(decoded.jti).toBe(payload.jti);
        });

        it('should use existing exp if provided', () => {
            const exp = Math.floor(Date.now() / 1000) + 3600;
            const payload: RefreshTokenPayload = {
                sub: 'user123',
                role: 'user',
                jti: 'unique-id',
                exp
            };

            const token = jwtService.generateRefreshToken(payload);
            const decoded = verify(token, jwtService['publicKey'], { algorithms: ['RS256'] }) as RefreshTokenPayload;
            expect(decoded.exp).toBe(exp);
        });
    });

    describe('verifyRefreshToken', () => {
        it('should verify a valid refresh token', async () => {
            const payload: RefreshTokenPayload = {
                sub: 'user123',
                role: 'user',
                jti: 'unique-id',
                exp: Math.floor(Date.now() / 1000) + 3600
            };
            const token = jwtService.generateRefreshToken(payload);

            const result = await jwtService.verifyRefreshToken(token);
            expect(result).toMatchObject(payload);
        });

        it('should throw on invalid refresh token', async () => {
            await expect(
                jwtService.verifyRefreshToken('invalid.token')
            ).rejects.toThrow(ApiError);
        });
    });

    describe('saveJtiInBlackList', () => {
        it('should add a JTI to the blacklist', async () => {
            const jti = 'unique-jti';
            const expiresAt = new Date(Date.now() + 1000 * 60 * 60);

            const collection = jwtService['jtiCollection']() as jest.Mocked<Collection<JtiDocument>>;
            collection.insertOne.mockResolvedValue({
                acknowledged: true,
                insertedId: jti as any
            });

            const result = await jwtService.saveJtiInBlackList(jti, expiresAt);
            expect(result).toBe(jti);
            expect(collection.insertOne).toHaveBeenCalledWith({
                _id: jti,
                expiresAt,
                createdAt: expect.any(Date),
                updatedAt: expect.any(Date),
            });
        });

        it('should throw ApiError if insertOne fails', async () => {
            const collection = jwtService['jtiCollection']();
            (collection.insertOne as jest.Mock).mockRejectedValueOnce(new ApiError('JWT Service Error', StatusCodes.INTERNAL_SERVER_ERROR, 'JWT Service Error'));

            await expect(jwtService.saveJtiInBlackList('test', new Date()))
                .rejects.toThrow(ApiError);
        });
    });

    describe('deleteJtiFromBlackList', () => {
        it('should remove a JTI from the blacklist', async () => {
            const jti = 'unique-jti';

            const collection = jwtService['jtiCollection']() as jest.Mocked<Collection<JtiDocument>>;
            collection.deleteOne.mockResolvedValue({ deletedCount: 1 } as any);

            const result = await jwtService.deleteJtiFromBlackList(jti);
            expect(result).toBe(jti);
            expect(collection.deleteOne).toHaveBeenCalledWith({ _id: jti });
        });

        it('should throw ApiError if JTI is not found', async () => {
            const collection = jwtService['jtiCollection']();
            (collection.deleteOne as jest.Mock).mockResolvedValueOnce({ deletedCount: 0 });

            await expect(jwtService.deleteJtiFromBlackList('nonexistent'))
                .rejects.toThrow(new ApiError('Jti not found', StatusCodes.NOT_FOUND, 'Jti not found'));
        });
    });

    describe('getJtis', () => {
        it('should retrieve all JTIs from the blacklist', async () => {
            const mockJtis: JtiDocument[] = [
                {
                    _id: 'jti1',
                    Jti: 'jti1',
                    isDeleted: false,
                    expiresAt: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                {
                    _id: 'jti2',
                    Jti: 'jti2',
                    isDeleted: false,
                    expiresAt: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ];

            const collection = jwtService['jtiCollection']() as jest.Mocked<Collection<JtiDocument>>;
            collection.find.mockReturnValue({
                toArray: jest.fn().mockResolvedValue(mockJtis),
            } as any);

            const jtis = await jwtService.getJtis();
            expect(jtis).toEqual(mockJtis);
            expect(collection.find).toHaveBeenCalledWith({});
        });

        it('should throw ApiError if find fails', async () => {
            const collection = jwtService['jtiCollection']();
            (collection.find as jest.Mock).mockReturnValue({
                toArray: jest.fn().mockRejectedValue(new ApiError('JWT Service Error', StatusCodes.INTERNAL_SERVER_ERROR, 'JWT Service Error'))
            });

            await expect(jwtService.getJtis()).rejects.toThrow(ApiError);
            try {
                await jwtService.getJtis();
            } catch (error) {
                expect(error).toBeInstanceOf(ApiError);
                expect((error as ApiError).message).toBe('JWT Service Error');
                expect((error as ApiError).statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
            }
        });
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
            const invalidPayload = { role: 'user' } as AccessTokenPayload;
            expect(() => jwtService['validatePayload'](invalidPayload))
                .toThrow(new ApiError('Invalid subject claim', StatusCodes.BAD_REQUEST, 'Invalid payload'));
        });

        it('should throw when role is missing', () => {
            const invalidPayload = { sub: 'user123' } as AccessTokenPayload;
            expect(() => jwtService['validatePayload'](invalidPayload))
                .toThrow(new ApiError('Invalid role claim', StatusCodes.BAD_REQUEST, 'Invalid payload'));
        });

        it('should throw when subject is not a string', () => {
            const invalidPayload = { sub: 123, role: 'user' } as unknown as AccessTokenPayload;
            expect(() => jwtService['validatePayload'](invalidPayload))
                .toThrow(new ApiError('Invalid subject claim', StatusCodes.BAD_REQUEST, 'Invalid payload'));
        });

        it('should throw when role is not a string', () => {
            const invalidPayload = { sub: 'user123', role: 123 } as unknown as AccessTokenPayload;
            expect(() => jwtService['validatePayload'](invalidPayload))
                .toThrow(new ApiError('Invalid role claim', StatusCodes.BAD_REQUEST, 'Invalid payload'));
        });
    });
});

