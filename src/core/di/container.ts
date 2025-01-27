import 'reflect-metadata';
import { Container } from 'inversify';
import express, { Application } from 'express';

import { ValidationService } from '../validation/validation.service';
import { HealthService } from '../../services/health.service';
import { HealthController } from '../../controllers/health.controller';
import { HealthRoutes } from '../../routes/health.routes';
import { Routes } from '../../routes';
import { App } from '../../app';

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

export { container };