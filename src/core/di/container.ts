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
import { QueueService } from '../../services/queue.service';
import { QueueController } from '../../controllers/queue.controller';
import { QueueRoutes } from '../../routes/queue.routes';

import { TYPES } from './types';
import { RetryService } from '@gateway/services/retry.service';


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
container.bind<RetryService>(TYPES.RetryService).to(RetryService)

export { container };