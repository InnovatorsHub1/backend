import { Queue, Worker, QueueEvents, Job, QueueOptions } from 'bullmq';
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
  private queue: Queue;
  private worker: Worker;
  private queueEvents: QueueEvents;

  constructor() {
    const redisOptions: QueueOptions = {
      connection: {
        host: new URL(config.redisUrl).hostname,
        port: Number(new URL(config.redisUrl).port) || 6379,
        password: new URL(config.redisUrl).password || undefined
      }
    };

    // ✅ Initialize Queue, Worker & QueueEvents
    this.queue = new Queue(config.queueName, redisOptions);
    this.queueEvents = new QueueEvents(config.queueName, redisOptions);
    this.setupEventListeners();
    this.worker = this.createWorker();
    
  }

  public getQueueEvents() {
    return this.queueEvents; // ✅ Exposes queue events
  }

  /**
   * ✅ Add a job to the queue.
   * @param data - The job data.
   * @param delay - Optional delay in milliseconds.
   * @param priority - Job priority (lower number = higher priority).
   */
  public async enqueue(data: any, delay = 0, priority = 1): Promise<Job> {
    return await this.queue.add('job', data, {
      attempts: config.maxRetries,
      backoff: { type: 'fixed', delay: config.retryDelay }, 
      delay,
      priority
    });
  }

  /**
   * ✅ Get the status of a job.
   * @param jobId - The ID of the job.
   * @returns JobState or null if not found.
   */
  public async getJobStatus(jobId: string): Promise<JobState | null> {
    const job = await this.queue.getJob(jobId);
    if (!job) return null;
    const state = await job.getState();
    
    switch (state) {
      case 'completed': return JobState.COMPLETED;
      case 'failed': return JobState.FAILED;
      case 'waiting': return JobState.QUEUED;
      case 'active': return JobState.PROCESSING;
      case 'delayed': return JobState.SCHEDULED;
      default: return null;
    }
  }

  /**
   * ✅ Cancel a queued job.
   * @param jobId - The job ID.
   * @returns True if canceled, otherwise false.
   */
  public async cancelJob(jobId: string): Promise<boolean> {
    const job = await this.queue.getJob(jobId);
    if (!job) return false;
    try {
      await job.remove();
      return true;
    } catch (error) {
      console.error(`❌ Could not remove job ${jobId}:`, error);
      return false;
    }
  }

  /**
   * ✅ Retry a failed job.
   * @param jobId - The job ID.
   * @returns True if retried, otherwise false.
   */
  public async retryJob(jobId: string): Promise<boolean> {
    const job = await this.queue.getJob(jobId);
    if (!job) return false;
    try {
      await job.retry();
      return true;
    } catch (error) {
      console.error(`❌ Could not retry job ${jobId}:`, error);
      return false;
    }
  }

  /**
   * ✅ Clear all jobs from the queue.
   */
  public async clearQueue(): Promise<void> {
    await this.queue.drain();
  }

  /**
   * ✅ Start worker for processing jobs with concurrency settings.
   */
  private createWorker(): Worker {
    return new Worker(
      config.queueName,
      async (job) => {
        console.log(`🔄 Processing job ${job.id} with data:`, job.data);
        await new Promise(resolve => setTimeout(resolve, config.pollInterval));
        console.log(`✅ Job ${job.id} completed successfully.`);
        return { success: true };
      },
      {
        connection: this.queue.opts.connection,
        concurrency: config.concurrency
      }
    );
  }

  /**
   * ✅ Register event listeners for job lifecycle monitoring.
   */
  private setupEventListeners(): void {
    this.queueEvents.on('completed', ({ jobId }) => {
      console.log(`✅ Job ${jobId} successfully completed.`);
    });

    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      console.error(`❌ Job ${jobId} failed. Error: ${failedReason}`);
    });

    this.queueEvents.on('stalled', ({ jobId }) => {
      console.warn(`⚠️ Job ${jobId} has stalled and will be retried.`);
    });

    this.queueEvents.on('active', ({ jobId }) => {
      console.log(`🛠️ Job ${jobId} is now active.`);
    });

    this.queueEvents.on('waiting', ({ jobId }) => {
      console.log(`⏳ Job ${jobId} is waiting to be processed.`);
    });

    this.queueEvents.on('progress', ({ jobId, data }) => {
      console.log(`⏳ Job ${jobId} is ${data}% complete.`);
    });

    console.log('📢 Queue event listeners initialized.');
  }

  /**
   * ✅ Gracefully shut down queue and workers.
   */
  public async closeQueue(): Promise<void> {
    console.log('🛑 Shutting down Queue & Worker...');
    await this.worker.close();
    await this.queue.close();
    await this.queueEvents.close();
  }
}
