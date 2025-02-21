import 'reflect-metadata';
import { Container } from 'inversify';
import express, { Application } from 'express';
import { AuthService } from '@gateway/services/auth/auth.service';
import { AuthController } from '@gateway/controllers/auth.controller';
import { RetryService } from '@gateway/services/retry.service';

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
import { AuthRoutes } from '../../routes/auth.routes';


import { TYPES } from './types';


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
container.bind<RetryService>(TYPES.RetryService).to(RetryService);
container.bind<AuthService>(TYPES.AuthService).to(AuthService);
container.bind<AuthController>(TYPES.AuthController).to(AuthController);
container.bind<AuthRoutes>(TYPES.AuthRoutes).to(AuthRoutes);

export { container };