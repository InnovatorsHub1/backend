import { Router } from 'express';
import { inject, injectable } from 'inversify';
import { QueueController } from '../controllers/queue.controller';
import { TYPES } from '../core/di/types';

@injectable()
export class QueueRoutes {
  public router: Router;

  constructor(
    @inject(TYPES.QueueController) private readonly queueController: QueueController
  ) {
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.router.post('/enqueue', this.queueController.enqueue.bind(this.queueController));
    this.router.post('/dequeue/:jobId', this.queueController.dequeue.bind(this.queueController));
    this.router.get('/status/:jobId', this.queueController.getJobStatus.bind(this.queueController));
    this.router.post('/cancel/:jobId', this.queueController.cancelJob.bind(this.queueController));
    this.router.post('/retry/:jobId', this.queueController.retryJob.bind(this.queueController));
  }
}
