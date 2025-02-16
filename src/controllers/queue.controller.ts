import { Request, Response } from 'express';
import { inject, injectable } from 'inversify';
import { QueueService } from '../services/queue.service';
import { TYPES } from '../core/di/types';
import { StatusCodes } from 'http-status-codes';


@injectable()
export class QueueController {
  constructor(
    @inject(TYPES.QueueService) private readonly queueService: QueueService
  ) {}

  /**
   * ✅ Enqueue a job.
   */
  public async enqueue(req: Request, res: Response): Promise<void> {
    try {
      const job = await this.queueService.enqueue(req.body);
      res.status(StatusCodes.OK).json({ message: 'Job added', jobId: job.id });
    } catch (error) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to enqueue job', error });
    }
  }

  /**
   * ✅ Get job status.
   */
  public async getJobStatus(req: Request, res: Response): Promise<void> {
    const { jobId } = req.params;
    const status = await this.queueService.getJobStatus(jobId);

    if (!status) {
      res.status(StatusCodes.NOT_FOUND).json({ message: 'Job not found' });
    } else {
      res.status(StatusCodes.OK).json({ status });
    }
  }

  /**
   * ✅ Cancel a queued job.
   */
  public async cancelJob(req: Request, res: Response): Promise<void> {
    const { jobId } = req.params;
    const success = await this.queueService.cancelJob(jobId);

    if (success) {
      res.status(StatusCodes.OK).json({ message: `Job canceled: ${jobId}` });
    } else {
      res.status(StatusCodes.NOT_FOUND).json({ message: 'Job not found or already completed' });
    }
  }

  /**
   * ✅ Retry a failed job.
   */
  public async retryJob(req: Request, res: Response): Promise<void> {
    const { jobId } = req.params;
    const success = await this.queueService.retryJob(jobId);

    if (!success) {
      res.status(StatusCodes.NOT_FOUND).json({ message: 'Job not found or cannot be retried' });
    } else {
      res.status(StatusCodes.OK).json({ message: 'Job retried' });
    }
  }
}
