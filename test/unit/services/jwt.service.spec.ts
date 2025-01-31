// JwtService.test.ts

import { JwtService } from '@gateway/services/jwt';
import { AccessTokenPayload, RefreshTokenPayload, JtiDocument } from '@gateway/services/jwt/types';
import { sign, verify, JwtPayload } from 'jsonwebtoken';
import { mongoConnection } from '@gateway/utils/mongoConnection';
import { ApiError } from '@gateway/core/errors/api.error';
import { StatusCodes } from 'http-status-codes';
import fs from 'fs';
import { config } from '@gateway/config';
import { Collection } from 'mongodb';

// Mocking 'fs' module
jest.mock('fs');

// Mocking 'mongoConnection' module
jest.mock('@gateway/utils/mongoConnection');

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedMongoConnection = mongoConnection as jest.Mocked<any>;

describe('JwtService', () => {
    let jwtService: JwtService;
    const dummyPublicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtY98bH+hV/6hNn6M2sQo
WcCgmSnYx17LRn0TIedljtggTllsk/OHqYBDXiV6XEsKIM+dvzdBbB4N9tzIjVEx
7rjh5B3k0o+vG7E4Zx8i3bJdS/y4oRrL3GsHeaOzMDjUwUOs3HZmBjv+6HqtM0Z0
N7LKNvJqGbhD5HJ2cBf/CKq65kIGS3vKGyZCsc0mKmgUGX7pL6Hgk6kzJzj+fEfe
nd4qE5YIZm4yKMFkqPLCl+n0R1P5g8K0T6qjsHHOIqgUZJfXe5+bD2v3aN8bMN0Y
PLa9oc6d6eflYk6vB+G2rR0l2mXQKqckpA93+4XpK/0/JvMTgP20aXcPCTg0hqHy
qwIDAQAB
-----END PUBLIC KEY-----`;

    const dummyPrivateKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEAtY98bH+hV/6hNn6M2sQoWcCgmSnYx17LRn0TIedljtggTlls
k/OHqYBDXiV6XEsKIM+dvzdBbB4N9tzIjVEx7rjh5B3k0o+vG7E4Zx8i3bJdS/y4
oRrL3GsHeaOzMDjUwUOs3HZmBjv+6HqtM0Z0N7LKNvJqGbhD5HJ2cBf/CKq65kIG
S3vKGyZCsc0mKmgUGX7pL6Hgk6kzJzj+fEfenD4qE5YIZm4yKMFkqPLCl+n0R1P5
g8K0T6qjsHHOIqgUZJfXe5+bD2v3aN8bMN0YPLa9oc6d6eflYk6vB+G2rR0l2mXQ
KqckpA93+4XpK/0/JvMTgP20aXcPCTg0hqHyqwIDAQABAoIBAQC+vs1fO9ZoMS0F
mNIfu40p/gZXXQgkEHE1qhRY6G1RlIkpR0VYnKdH8e1LWM6mqKkgIq5Tc2LLaTtr
9IjbFOgdf8HtXXxkNLN9sGw1jItgGf/6s4DUBK69qTmmMRxXAJX3Jr8ZpbEJo1M6
kLSjlQabESeXkg8nBIATzX96+BlHp7+ZZwXOcj+FnYIBlCv88Z42qSeYAgQYc2Lc
doX9UEm6eCWRLOlC/bYYkyxbvgzB5vjC/WGbPOTdmt/6q9kyLk2sm6Mr3QfVjq1h
TVEuw6eYEEVu9yhjiBxPyGYp1mgfoj0mTTmHR2Sk1PmhbzlYhaZdkzXjVwkxFZAA
4MOKm+XpAoGBANXIr8gEYPc72+rUlA7KdJ8fx0eDhxnqugAPpUq/PR2Ov6aBvh30
gJVK4PpXXCzbfZt3NkBdcpxA/BpVHSbSnZqsrbRYzpChmn14o9JVH7Jz9AI1PGsH
2JcGjPha6oGscsKTkEUXw0Kg0q/8Eb2KwnapX0dfPgmHeuB6sDyy6bhrAoGBAM0+
yxV8iPssgXXIDz+3JJ3FrDphFpl5SksMFN6/5afdy1+RvHHcUfkhJzjs5Esu62Hv
xfXelIvPKxk7GwvqL9cIS0nBMDiIyEWmAgciGD94RmS05xtA6d9+syLbwOXbCsJv
7Uf58FE0Akl0USSlr1Jz5eT6eF56Xkb4VPTUrCMjAoGABBr+fkGwfhAQDqKci30H
PRXjpF1v1AVfUihIY1xqjfxPaUL6hQMWkWeuQZVxPldYpuZ78jYxms2LwdFAHyk9
zUnrBZVbpXg3RRcEyBdpym0Gnc0gKn2n60E2rBQGKhhnIrvzw28hZaVMyRgYtGCF
Vjfsy+31kNYbwl3FXFa43LUCgYEAwlgRKTiEiqTzwr4avdK1A7UVjFxkdkfNmpcR
kcIsqCFo3iOYxOzABxBGNsAwC7G9R46btz+BPO+q7wJvX/3BIJotSSEzbNGdlHpw
uf6hnj3hMnrIToOHM3GMqzBvgw2oznjPcm0lmUZ3HDnFx2EDtCNX6PDtSF5+6vY5
rN8GpjECgYBwb8DdjHNS17eLiNp5RiMKuvnV3/S25DTj+VpxIQrVfGuz7IyvwyWJ
mAFBvNgi6Q8IuJixS0LApQCmDCuN5k9BMXRr2DV7gdPrZgy/XuEwmzgxFXXEycZ0
JzqeNhxCQ3MlnrIDFWQcDyI6/HzDkUGiAGQW1ijQcS7U1K6B7E6mYA==
-----END RSA PRIVATE KEY-----`;

    beforeEach(() => {
        jest.resetAllMocks();

        // Mock fs.readFileSync to return dummy keys
        mockedFs.readFileSync.mockImplementation((path: fs.PathOrFileDescriptor, options?: any) => {
            if (path === config.jwtPublicKeyPath) {
                return dummyPublicKey;
            } else if (path === config.jwtPrivateKeyPath) {
                return dummyPrivateKey;
            }
            throw new Error('File not found');
        });

        // Mock mongoConnection methods
        const mockCollection = {
            createIndex: jest.fn().mockResolvedValue('TTL index created'),
            findOne: jest.fn().mockReturnValue(Promise.resolve(null)),
            insertOne: jest.fn(),
            deleteOne: jest.fn(),
            find: jest.fn().mockReturnValue({
                toArray: jest.fn()
            }),
        } as any;

        mockedMongoConnection.getClient.mockReturnValue({
            db: jest.fn().mockReturnValue({
                collection: jest.fn().mockReturnValue(mockCollection)
            })
        });
    });

    beforeEach(() => {
        jwtService = new JwtService();
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
            const payload: AccessTokenPayload = {
                sub: '123',
                role: 'user',
                exp: 1712000000
            };
            const token = jwtService.generateToken(payload);
            const decoded = verify(token, dummyPublicKey, { algorithms: ['RS256'] }) as JwtPayload;
            expect(decoded).toMatchObject(payload);
        });
    });

    describe('generateRefreshToken', () => {
        it('should generate a valid refresh token', () => {
            const payload: RefreshTokenPayload = { sub: '123', role: 'user', exp: 1712000000, jti: 'unique-jti' };
            const token = jwtService.generateRefreshToken(payload);
            const decoded = verify(token, dummyPublicKey, { algorithms: ['RS256'] }) as JwtPayload;
            expect(decoded).toMatchObject(payload);
        });
    });

    describe('verifyToken', () => {
        it('should verify a valid access token', () => {
            const payload: AccessTokenPayload = { sub: '123', role: 'user', exp: 1712000000 };
            const token = sign(payload, dummyPrivateKey, { expiresIn: '15m', algorithm: 'RS256' });
            const verified = jwtService.verifyToken(token);
            expect(verified).toMatchObject(payload);
        });

        it('should throw ApiError if token is invalid', () => {
            const invalidToken = 'invalid.token.here';
            expect(() => jwtService.verifyToken(invalidToken)).toThrow(ApiError);
            try {
                jwtService.verifyToken(invalidToken);
            } catch (error) {
                expect(error).toBeInstanceOf(ApiError);
                expect((error as ApiError).message).toBe('Invalid token');
                expect((error as ApiError).statusCode).toBe(StatusCodes.UNAUTHORIZED);
            }
        });

        it('should throw ApiError if token is expired', async () => {
            const payload: AccessTokenPayload = { sub: '123', role: 'user', exp: 1712000000 };
            const token = sign(payload, dummyPrivateKey, { expiresIn: '1ms', algorithm: 'RS256' });

            // Wait for token to expire
            await new Promise((resolve) => setTimeout(resolve, 10));

            expect(() => jwtService.verifyToken(token)).toThrow(ApiError);
            try {
                jwtService.verifyToken(token);
            } catch (error) {
                expect(error).toBeInstanceOf(ApiError);
                expect((error as ApiError).message).toBe('Invalid token');
                expect((error as ApiError).statusCode).toBe(StatusCodes.UNAUTHORIZED);
            }
        });
    });

    describe('verifyRefreshToken', () => {
        it('should verify a valid refresh token', async () => {
            const payload: RefreshTokenPayload = { sub: '123', role: 'user', exp: 1712000000, jti: 'unique-jti' };
            const token = jwtService.generateRefreshToken(payload);

            // Mock isJtiInBlackList to return false
            const collection = jwtService['jtiCollection']() as jest.Mocked<Collection<JtiDocument>>;
            collection.findOne.mockResolvedValue(null);

            const verified = await jwtService.verifyRefreshToken(token);
            expect(verified).toMatchObject(payload);
        });

        it('should throw ApiError if refresh token is invalid', async () => {
            const invalidToken = 'invalid.refresh.token';
            await expect(jwtService.verifyRefreshToken(invalidToken)).rejects.toThrow(ApiError);
            try {
                await jwtService.verifyRefreshToken(invalidToken);
            } catch (error) {
                expect(error).toBeInstanceOf(ApiError);
                expect((error as ApiError).message).toBe('Invalid refresh token');
                expect((error as ApiError).statusCode).toBe(StatusCodes.UNAUTHORIZED);
            }
        });

        it('should throw ApiError if refresh token is expired', async () => {
            const payload: RefreshTokenPayload = { sub: '123', role: 'user', exp: 1712000000, jti: 'unique-jti' };
            const token = sign(payload, dummyPrivateKey, { expiresIn: '1ms', algorithm: 'RS256' });

            // Wait for token to expire
            await new Promise((resolve) => setTimeout(resolve, 10));

            await expect(jwtService.verifyRefreshToken(token)).rejects.toThrow(ApiError);
            try {
                await jwtService.verifyRefreshToken(token);
            } catch (error) {
                expect(error).toBeInstanceOf(ApiError);
                expect((error as ApiError).message).toBe('Refresh token expired');
                expect((error as ApiError).statusCode).toBe(StatusCodes.UNAUTHORIZED);
            }
        });

        it('should throw ApiError if refresh token is blacklisted', async () => {
            const payload: RefreshTokenPayload = { sub: '123', role: 'user', exp: 1712000000, jti: 'unique-jti' };
            const token = jwtService.generateRefreshToken(payload);

            // Mock isJtiInBlackList to return true
            const collection = jwtService['jtiCollection']() as jest.Mocked<Collection<JtiDocument>>;
            collection.findOne.mockResolvedValue({ _id: 'unique-jti', expiresAt: new Date() });

            await expect(jwtService.verifyRefreshToken(token)).rejects.toThrow(ApiError);
            try {
                await jwtService.verifyRefreshToken(token);
            } catch (error) {
                expect(error).toBeInstanceOf(ApiError);
                expect((error as ApiError).message).toBe('Refresh token revoked');
                expect((error as ApiError).statusCode).toBe(StatusCodes.UNAUTHORIZED);
            }
        });
    });

    describe('saveJtiInBlackList', () => {
        it('should add a JTI to the blacklist', async () => {
            const jti = 'unique-jti';
            const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour from now

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
            const jti = 'unique-jti';
            const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour from now

            const collection = jwtService['jtiCollection']() as jest.Mocked<Collection<JtiDocument>>;
            collection.insertOne.mockRejectedValue(new Error('DB error'));

            await expect(jwtService.saveJtiInBlackList(jti, expiresAt)).rejects.toThrow(ApiError);
            try {
                await jwtService.saveJtiInBlackList(jti, expiresAt);
            } catch (error) {
                expect(error).toBeInstanceOf(ApiError);
                expect((error as ApiError).message).toBe('JWT Service Error');
                expect((error as ApiError).statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
            }
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

        it('should throw ApiError if JTI is not found in the blacklist', async () => {
            const jti = 'nonexistent-jti';

            const collection = jwtService['jtiCollection']() as jest.Mocked<Collection<JtiDocument>>;
            collection.deleteOne.mockResolvedValue({ deletedCount: 0 } as any);

            await expect(jwtService.deleteJtiFromBlackList(jti)).rejects.toThrow(ApiError);
            try {
                await jwtService.deleteJtiFromBlackList(jti);
            } catch (error) {
                expect(error).toBeInstanceOf(ApiError);
                expect((error as ApiError).message).toBe('Jti not found');
                expect((error as ApiError).statusCode).toBe(StatusCodes.NOT_FOUND);
            }
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
            const collection = jwtService['jtiCollection']() as jest.Mocked<Collection<JtiDocument>>;
            collection.find.mockReturnValue({
                toArray: jest.fn().mockRejectedValue(new Error('DB error')),
            } as any);

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
});
