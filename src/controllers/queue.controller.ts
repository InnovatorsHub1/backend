import { Request, Response } from 'express';
import { inject, injectable } from 'inversify';
import { QueueService } from '../services/queue.service';
import { TYPES } from '../core/di/types';

@injectable()
export class QueueController {
  constructor(
    @inject(TYPES.QueueService) private readonly queueService: QueueService
  ) {}

  public async enqueue(req: Request, res: Response): Promise<void> {
    const job = await this.queueService.enqueue(req.body);
    res.status(200).json({ message: 'Job added', jobId: job.id });
  }

  public async getJobStatus(req: Request, res: Response): Promise<void> {
    const { jobId } = req.params;
    const status = await this.queueService.getJobStatus(jobId);
    res.status(200).json({ status });
  }

  public async cancelJob(req: Request, res: Response): Promise<void> {
    const { jobId } = req.params;
    const success = await this.queueService.cancelJob(jobId);
    res.status(200).json({ message: success ? 'Job canceled' : 'Job not found' });
  }

  public async retryJob(req: Request, res: Response): Promise<void> {
    const { jobId } = req.params;
    const success = await this.queueService.retryJob(jobId);
    res.status(200).json({ message: success ? 'Job retried' : 'Job not found' });
  }
}
