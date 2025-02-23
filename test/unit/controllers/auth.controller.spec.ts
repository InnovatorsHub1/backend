import { AuthController } from '@gateway/controllers/auth.controller';
import { AuthService } from '@gateway/services/auth/auth.service';
import { JwtService } from '@gateway/services/jwt/jwt.service';
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '@gateway/core/errors/api.error';

describe('AuthController', () => {
    let authController: AuthController;
    let authService: jest.Mocked<AuthService>;
    let jwtService: jest.Mocked<JwtService>;
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let mockNext: jest.Mock;


    function setDeviceInfo(req: Partial<Request>) {
        (req as any).deviceInfo = {
            ip: req.ip || 'Unknown',
            userAgent: (req.headers && req.headers['user-agent'] as string) || 'Unknown'
        };
    }

    beforeEach(() => {

        authService = {
            login: jest.fn(),
            signup: jest.fn(),
        } as any;

        jwtService = {
            generateAccessToken: jest.fn(),
            generateRefreshToken: jest.fn(),
            verifyToken: jest.fn(),
            revokeToken: jest.fn(),
            refreshTokens: jest.fn()
        } as any;

        mockRequest = {
            body: {
                email: 'test@example.com',
                password: 'Password123!'
            },
            cookies: {},
            headers: {},
            ip: '127.0.0.1'
        };

        setDeviceInfo(mockRequest);

        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            cookie: jest.fn(),
            clearCookie: jest.fn()
        };

        mockNext = jest.fn();

        authController = new AuthController(authService, jwtService);
    });

    describe('login', () => {
        it('should successfully login and set cookies', async () => {
            const credentials = {
                email: 'test@example.com',
                password: 'Password123!'
            };

            mockRequest.body = credentials;
            setDeviceInfo(mockRequest);

            const mockTokens = {
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
                id: 'user-123'
            };

            authService.login.mockResolvedValue(mockTokens);

            await authController.login(mockRequest as Request, mockResponse as Response, mockNext);

            expect(authService.login).toHaveBeenCalledWith(
                credentials.email,
                credentials.password,
                expect.objectContaining({
                    userAgent: 'Unknown',
                    ip: '127.0.0.1'
                })
            );

            expect(mockResponse.cookie).toHaveBeenNthCalledWith(1,
                'access_token',
                mockTokens.accessToken,
                {
                    httpOnly: true,
                    secure: false,
                    sameSite: 'strict'
                }
            );

            expect(mockResponse.cookie).toHaveBeenNthCalledWith(2,
                'refresh_token',
                mockTokens.refreshToken,
                {
                    httpOnly: true,
                    secure: false,
                    sameSite: 'strict'
                }
            );

            expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.OK);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'login success' });
        });

        it('should handle auth service errors', async () => {
            mockRequest.body = {
                email: 'test@example.com',
                password: 'Password123!'
            };
            setDeviceInfo(mockRequest);

            const error = new Error('Auth failed');
            authService.login.mockRejectedValue(error);

            await authController.login(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalledWith(error);
        });

        it('should handle invalid email format', async () => {
            mockRequest.body = {
                email: 'invalid-email',
                password: 'Password123!'
            };
            setDeviceInfo(mockRequest);

            authService.login.mockRejectedValue(
                new ApiError('Invalid email format', StatusCodes.BAD_REQUEST, 'AuthController')
            );

            await authController.login(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalledWith(
                expect.any(ApiError)
            );
        });

        it('should handle missing device info', async () => {
            mockRequest.body = {
                email: 'test@example.com',
                password: 'Password123!'
            };

            mockRequest.headers = {};
            (mockRequest as any).ip = undefined;


            setDeviceInfo(mockRequest);

            const mockTokens = {
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
                id: 'user-123'
            };

            authService.login.mockResolvedValue(mockTokens);

            await authController.login(mockRequest as Request, mockResponse as Response, mockNext);

            expect(authService.login).toHaveBeenCalledWith(
                'test@example.com',
                'Password123!',
                expect.objectContaining({
                    userAgent: 'Unknown',
                    ip: 'Unknown'
                })
            );
        });

        describe('device info handling', () => {
            const credentials = {
                email: 'test@example.com',
                password: 'Password123!'
            };

            const mockTokens = {
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
                id: 'user-123'
            };

            beforeEach(() => {
                mockRequest.body = credentials;
                authService.login.mockResolvedValue(mockTokens);
            });

            it('should use rawDeviceInfo.ip when available', async () => {
                mockRequest = {
                    body: credentials,
                    headers: { 'user-agent': 'test-agent' },
                    ip: '192.168.1.1',
                    cookies: {}
                };
                setDeviceInfo(mockRequest);

                await authController.login(mockRequest as Request, mockResponse as Response, mockNext);

                expect(authService.login).toHaveBeenCalledWith(
                    credentials.email,
                    credentials.password,
                    expect.objectContaining({
                        ip: '192.168.1.1',
                        userAgent: 'test-agent'
                    })
                );
            });

            it('should use "Unknown" when IP is undefined', async () => {
                mockRequest = {
                    body: credentials,
                    headers: {},
                    cookies: {}
                };
                setDeviceInfo(mockRequest);

                await authController.login(mockRequest as Request, mockResponse as Response, mockNext);

                expect(authService.login).toHaveBeenCalledWith(
                    credentials.email,
                    credentials.password,
                    expect.objectContaining({
                        ip: 'Unknown',
                        userAgent: 'Unknown'
                    })
                );
            });
        });
    });

    describe('logout', () => {
        it('should clear cookies and return success', async () => {
            mockRequest.cookies = { 'refresh_token': 'valid-token' };

            await authController.logout(mockRequest as Request, mockResponse as Response, mockNext);

            expect(jwtService.revokeToken).toHaveBeenCalledWith('valid-token');
            expect(mockResponse.clearCookie).toHaveBeenNthCalledWith(1, 'access_token');
            expect(mockResponse.clearCookie).toHaveBeenNthCalledWith(2, 'refresh_token');
            expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.OK);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'logout success' });
        });

        it('should handle missing refresh token', async () => {
            mockRequest.cookies = {};

            await authController.logout(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Unauthorized'
                })
            );
        });

        it('should handle logout errors', async () => {
            mockRequest.cookies = { 'refresh_token': 'valid-token' };
            const error = new Error('Logout failed');
            jwtService.revokeToken.mockRejectedValue(error);

            await authController.logout(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalledWith(error);
        });

        it('should handle invalid refresh token', async () => {
            mockRequest.cookies = { 'refresh_token': '' };

            await authController.logout(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalledWith(
                new ApiError('Unauthorized', StatusCodes.UNAUTHORIZED, 'AuthController')
            );
        });

        it('should handle token verification error', async () => {
            mockRequest.cookies = { 'refresh_token': 'invalid-token' };
            jwtService.revokeToken.mockRejectedValue(
                new ApiError('Invalid token', StatusCodes.UNAUTHORIZED, 'JwtService')
            );

            await authController.logout(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Invalid token'
                })
            );
        });
    });

    describe('refresh', () => {
        it('should refresh access token successfully', async () => {
            mockRequest.cookies = { 'refresh_token': 'valid-refresh-token' };
            const newAccessToken = 'new-access-token';
            jwtService.refreshTokens.mockResolvedValue({ accessToken: newAccessToken, refreshToken: 'new-refresh-token' });

            await authController.refresh(mockRequest as Request, mockResponse as Response, mockNext);

            expect(jwtService.refreshTokens).toHaveBeenCalledWith('valid-refresh-token');
            expect(mockResponse.cookie).toHaveBeenCalledWith('access_token', newAccessToken, {
                httpOnly: true,
                secure: false,
                sameSite: 'strict'
            });
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'refresh success' });
        });

        it('should handle missing refresh token', async () => {
            mockRequest.cookies = {};

            await authController.refresh(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'No refresh token provided' });
        });

        it('should handle refresh token errors', async () => {
            mockRequest.cookies = { 'refresh_token': 'invalid-token' };
            const error = new Error('Token refresh failed');
            jwtService.refreshTokens.mockRejectedValue(error);

            await authController.refresh(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalledWith(error);
        });
    });

    describe('signup', () => {
        let credentials: {
            email: string;
            password: string;
            firstName: string;
            lastName: string;
            phoneNumber: string;
        };
        let signupResponse: any;
        let loginResponse: { accessToken: string; refreshToken: string };

        beforeEach(() => {
            credentials = {
                email: 'test@example.com',
                password: 'Password123!',
                firstName: 'Test',
                lastName: 'User',
                phoneNumber: '0521234567'
            };

            signupResponse = {};

            loginResponse = {
                accessToken: 'access-token',
                refreshToken: 'refresh-token'
            };

            mockRequest.body = { ...credentials };

            (authController as any).configCookie = { httpOnly: true, secure: false, sameSite: 'strict' };

            authService.signup.mockResolvedValue(signupResponse);
            authService.login.mockResolvedValue({ ...loginResponse, id: 'user-123' });
        });

        it('should signup user, set cookies, and return success message', async () => {
            await authController.signup(mockRequest as Request, mockResponse as Response, mockNext);

            expect(authService.signup).toHaveBeenCalledWith({
                email: credentials.email,
                password: credentials.password,
                profile: {
                    firstName: credentials.firstName,
                    lastName: credentials.lastName,
                    phoneNumber: credentials.phoneNumber
                }
            });

            expect(authService.login).toHaveBeenCalledWith(credentials.email, credentials.password, expect.objectContaining({
                ip: '127.0.0.1',
                userAgent: 'Unknown'
            }));

            expect(mockResponse.cookie).toHaveBeenCalledWith('access_token', loginResponse.accessToken, {
                httpOnly: true,
                secure: false,
                sameSite: 'strict'
            });
            expect(mockResponse.cookie).toHaveBeenCalledWith('refresh_token', loginResponse.refreshToken, {
                httpOnly: true,
                secure: false,
                sameSite: 'strict'
            });

            expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.CREATED);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'User created successfully' });
        });

        it('should call next with error if signup fails', async () => {
            const error = new Error('Signup failed');
            authService.signup.mockRejectedValue(error);

            await authController.signup(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalledWith(error);
        });

        it('should call next with error if login fails', async () => {
            const error = new Error('Login failed');
            authService.login.mockRejectedValue(error);

            await authController.signup(mockRequest as Request, mockResponse as Response, mockNext);

            expect(mockNext).toHaveBeenCalledWith(error);
        });
    });
}); 