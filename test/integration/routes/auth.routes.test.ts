import express from 'express';
import request from 'supertest';
import { AuthRoutes } from '@gateway/routes/auth.routes';
import { AuthController } from '@gateway/controllers/auth.controller';
import { Request, Response, NextFunction } from 'express';

jest.mock('@gateway/middleware/validate-request.middleware', () => ({
    createValidator: jest.fn((schema) => {
        return (req: Request, res: Response, next: NextFunction) => {
            const missingFields: string[] = [];
            if (schema.body && Array.isArray(schema.body)) {
                schema.body.forEach((field: string) => {
                    if (!req.body || !req.body[field] || req.body[field].trim() === '') {
                        missingFields.push(field);
                    }
                });
            }
            if (missingFields.length > 0) {
                return res.status(400).json({ error: `Missing fields: ${missingFields.join(', ')}` });
            }
            next();
        };
    })
}));

describe('AuthRoutes', () => {
    let app: express.Express;
    let authController: Partial<AuthController>;
    let authRoutes: AuthRoutes;

    beforeEach(() => {

        authController = {
            signup: jest.fn((req, res) => res.status(200).json({ message: 'signup success' })),
            login: jest.fn((req, res) => res.status(200).json({ message: 'login success' })),
            refresh: jest.fn((req, res) => res.status(200).json({ message: 'refresh success' })),
            logout: jest.fn((req, res) => res.status(200).json({ message: 'logout success' }))
        } as any;


        authRoutes = new AuthRoutes(authController as AuthController);


        app = express();
        app.use(express.json());
        app.use('/auth', authRoutes.router);
    });

    it('should call controller.signup on POST /auth/signup with valid body', async () => {
        const payload = { email: 'test@example.com', password: 'secret' };

        const response = await request(app)
            .post('/auth/signup')
            .send(payload)
            .expect(200);

        expect(response.body).toEqual({ message: 'signup success' });
        expect(authController.signup).toHaveBeenCalled();
    });

    it('should call controller.signup on POST /auth/signup with missing fields', async () => {

        const payload = { email: 'test@example.com', password: '' };

        const response = await request(app)
            .post('/auth/signup')
            .send(payload)
            .expect(400);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('password');

        expect(authController.signup).not.toHaveBeenCalled();
    });

    it('should call controller.login on POST /auth/login with valid body', async () => {
        const payload = { email: 'test@example.com', password: 'secret' };

        const response = await request(app)
            .post('/auth/login')
            .send(payload)
            .expect(200);

        expect(response.body).toEqual({ message: 'login success' });
        expect(authController.login).toHaveBeenCalled();
    });

    it('should return 400 on POST /auth/login with missing fields', async () => {

        const payload = { email: 'test@example.com' };

        const response = await request(app)
            .post('/auth/login')
            .send(payload)
            .expect(400);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('password');

        expect(authController.login).not.toHaveBeenCalled();
    });

    it('should call controller.refresh on POST /auth/refresh', async () => {
        const response = await request(app)
            .post('/auth/refresh')
            .send({})
            .expect(200);

        expect(response.body).toEqual({ message: 'refresh success' });
        expect(authController.refresh).toHaveBeenCalled();
    });

    it('should call controller.logout on POST /auth/logout', async () => {
        const response = await request(app)
            .post('/auth/logout')
            .send({})
            .expect(200);

        expect(response.body).toEqual({ message: 'logout success' });
        expect(authController.logout).toHaveBeenCalled();
    });
});
