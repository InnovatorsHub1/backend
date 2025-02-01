import Bull, { Job, QueueOptions } from 'bull';
import { injectable } from 'inversify';
import { config } from '../config';

export enum JobState {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  SCHEDULED = 'scheduled',
  RETRYING = 'retrying'
}

@injectable()
export class QueueService {
  private queue: Bull.Queue;

  constructor() {
    const redisUrl = new URL(config.redisUrl);
    const redisOptions: QueueOptions = {
      redis: {
        host: redisUrl.hostname,
        port: Number(redisUrl.port) || 6379,
        password: redisUrl.password || undefined
      }
    };

    this.queue = new Bull(config.queueName, redisOptions);
    this.processJobs();
    this.registerEventListeners();
  }

  /**
   * Add a job to the queue.
   * @param data - The job data.
   * @param delay - Optional delay in milliseconds.
   * @param priority - Job priority (lower number = higher priority).
   */
  public async enqueue(data: any, delay = 0, priority = 1): Promise<Job> {
    return await this.queue.add(data, {
      attempts: config.maxRetries,
      backoff: config.retryDelay,
      timeout: config.jobTimeout,
      delay,
      priority // Lower value means higher priority
    });
  }

  /**
   * Get the status of a job.
   * @param jobId - The ID of the job.
   * @returns JobState or null if not found.
   */
  public async getJobStatus(jobId: string): Promise<JobState | null> {
    const job = await this.queue.getJob(jobId);
    if (!job) return null;
    if (job.failedReason) return JobState.FAILED;
    if (job.finishedOn) return JobState.COMPLETED;
    if (job.processedOn) return JobState.PROCESSING;
    return JobState.QUEUED;
  }

  /**
   * Cancel a queued job.
   * @param jobId - The job ID.
   * @returns True if canceled, otherwise false.
   */
  public async cancelJob(jobId: string): Promise<boolean> {
    const job = await this.queue.getJob(jobId);
    if (!job) return false;
    await job.remove();
    return true;
  }

  /**
   * Retry a failed job.
   * @param jobId - The job ID.
   * @returns True if retried, otherwise false.
   */
  public async retryJob(jobId: string): Promise<boolean> {
    const job = await this.queue.getJob(jobId);
    if (!job || job.finishedOn) return false;
    await job.retry();
    return true;
  }

  /**
   * Clear all jobs from the queue.
   */
  public async clearQueue(): Promise<void> {
    await this.queue.empty();
  }

  /**
   * Process jobs with concurrency settings.
   */
  private processJobs(): void {
    this.queue.process(config.concurrency, async (job) => {
      try {
        console.log(`🔄 Processing job ${job.id} with data:`, job.data);

        // Simulated processing delay
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log(`✅ Job ${job.id} completed successfully.`);
        return { success: true };
      } catch (error) {
        console.error(`❌ Job ${job.id} failed with error:`, error);
        throw error;
      }
    });
  }

  /**
   * Register event listeners for better monitoring.
   */
  private registerEventListeners(): void {
    this.queue.on('completed', (job) => {
      console.log(`✅ Job ${job.id} successfully completed.`);
    });

    this.queue.on('failed', (job, err) => {
      console.error(`❌ Job ${job.id} failed. Error:`, err);
    });

    this.queue.on('stalled', (job) => {
      console.warn(`⚠️ Job ${job.id} has stalled and will be retried.`);
    });

    this.queue.on('progress', (job, progress) => {
      console.log(`⏳ Job ${job.id} is ${progress}% complete.`);
    });

    this.queue.on('active', (job) => {
      console.log(`🛠️ Job ${job.id} is now active.`);
    });

    this.queue.on('removed', (job) => {
      console.log(`🗑️ Job ${job.id} was removed from the queue.`);
    });
  }
}
