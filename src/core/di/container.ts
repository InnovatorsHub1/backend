import 'reflect-metadata';
import { Container } from 'inversify';
import express, { Application } from 'express';
import { ValidationService } from '../validation/validation.service';
import { HealthService } from '../../services/health.service';
import { HealthController } from '../../controllers/health.controller';
import { HealthRoutes } from '../../routes/health.routes';
import { Routes } from '../../routes';
import { App } from '../../app';
import { PDFService } from '../../services/pdf/pdf.service';
import { TemplateService } from '../../services/pdf/template.service';
import { PDFController } from '../../controllers/pdf.controller';
import { PDFRoutes } from '../../routes/pdf.routes';
import { QueueService } from '../../services/queue/queue.service';
import { QueueController } from '../../controllers/queue.controller';
import { QueueRoutes } from '../../routes/queue.routes';
import { TYPES } from './types';
import { RetryService } from '../../services/retry.service';
import { JwtService } from '../../services/jwt/jwt.service';
import { AuthService } from '../../services/auth/auth.service';
import { PasswordService } from '../../services/auth/password.service';
import { SessionService } from '../../services/auth/session.service';
import { UserRepository } from '../../repositories/user/UserRepository';
import { AuthController } from '@gateway/controllers/auth.controller';
import { AuthRoutes } from '@gateway/routes/auth.routes';


const container = new Container({ defaultScope: 'Singleton' });

// Create Express application instance
const expressApp: Application = express();

// Register services with proper scoping
container.bind<Application>('Application').toConstantValue(expressApp);
container.bind<HealthService>(TYPES.HealthService).to(HealthService);
container.bind<HealthController>(TYPES.HealthController).to(HealthController);
container.bind<HealthRoutes>(TYPES.HealthRoutes).to(HealthRoutes);
container.bind<Routes>(TYPES.Routes).to(Routes);
container.bind<App>(TYPES.App).to(App);
container.bind<ValidationService>(TYPES.ValidationService).to(ValidationService);
container.bind<PDFService>(TYPES.PDFService).to(PDFService);
container.bind<TemplateService>(TYPES.TemplateService).to(TemplateService);
container.bind<PDFController>(TYPES.PDFController).to(PDFController);
container.bind<PDFRoutes>(TYPES.PDFRoutes).to(PDFRoutes);
container.bind<QueueService>(TYPES.QueueService).to(QueueService);
container.bind<QueueController>(TYPES.QueueController).to(QueueController);
container.bind<QueueRoutes>(TYPES.QueueRoutes).to(QueueRoutes); 
container.bind<UserRepository>(TYPES.UserRepository).to(UserRepository);
container.bind<JwtService>(TYPES.JwtService).to(JwtService);
container.bind<AuthService>(TYPES.AuthService).to(AuthService);
container.bind<PasswordService>(TYPES.PasswordService).to(PasswordService);
container.bind<SessionService>(TYPES.SessionService).to(SessionService);
container.bind<AuthController>(TYPES.AuthController).to(AuthController);
container.bind<AuthRoutes>(TYPES.AuthRoutes).to(AuthRoutes);
container.bind<RetryService>(TYPES.RetryService).to(RetryService)

export { container };