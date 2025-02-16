import { Queue, Worker, QueueEvents, Job, QueueOptions } from 'bullmq';
import IORedis from 'ioredis';
import { injectable } from 'inversify';
import { config } from '../config';
import { WinstonLogger } from '@gateway/core/logger/winston.logger';

export enum JobState {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  SCHEDULED = 'scheduled',
  RETRYING = 'retrying'
}

const logger = new WinstonLogger('QueueService');

@injectable()
export class QueueService {
  private queue: Queue;
  private worker: Worker;
  private queueEvents: QueueEvents;
  private redisConnection : IORedis;
  

  constructor() {
    this.redisConnection = new IORedis(config.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    

    const redisOptions: QueueOptions = {
      connection: this.redisConnection,
    };

    this.queue = new Queue(config.queueName, redisOptions);
    this.queueEvents = new QueueEvents(config.queueName, redisOptions);
    this.setupEventListeners();
    this.worker = this.createWorker();
  
    
  }

  public getQueueEvents() {
    return this.queueEvents; 
  }

  /**
   * ✅ Add a job to the queue.
   * @param data - The job data.
   * @param delay - Optional delay in milliseconds.
   * @param priority - Job priority (lower number = higher priority).
   */
  public async enqueue<T>(data: T, delay = 0, priority = 1): Promise<Job> {
    const job = await this.queue.add('job', data, {
      attempts: config.maxRetries,
      backoff: { type: 'fixed', delay: config.retryDelay }, 
      delay,
      priority
    });

    if(!job){
      throw new Error('Failed to enqueue job');

    }
    return job;
  }

  /**
   * ✅ Get the status of a job.
   * @param jobId - The ID of the job.
   * @returns JobState or null if not found.
   */
  public async getJobStatus(jobId: string): Promise<JobState | null> {
    try{
      const job = await this.queue.getJob(jobId);
      if (!job) {
        logger.warn(`⚠️ Job with ID ${jobId} not found.`);
        return null;
      }
      const state = await job.getState();
      logger.info(`📊 Job ${jobId} state: ${state}`);
    
      switch (state) {
        case 'completed': return JobState.COMPLETED;
        case 'failed': return JobState.FAILED;
        case 'waiting': return JobState.QUEUED;
        case 'active': return JobState.PROCESSING;
        case 'delayed': return JobState.SCHEDULED;
        case 'prioritized': return JobState.QUEUED;
        default: logger.warn(`⚠️ Unknown job state for job ${jobId}: ${state}`);
        return null;
      }
    } catch (error ) {
      let errorMessage= 'Unknown error occurred';
      if(error instanceof Error){
        errorMessage = error.message;
      } else if(typeof error === 'string'){
        errorMessage = error;
      }
      logger.error(`❌ Error retrieving job status for job ID ${jobId}`, { errorMessage });
      return null;
      
  }
}

  /**
   * ✅ Cancel a queued job.
   * @param jobId - The job ID.
   * @returns True if canceled, otherwise false.
   */
  public async cancelJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.queue.getJob(jobId);
      if (!job) {
        logger.warn(`⚠️ Job with ID ${jobId} not found.`);
        return false;
      }
  
      const state = await job.getState();
      if (state === 'active') {
        logger.warn(`⚠️ Job ${jobId} is active. Moving it to failed state.`);
        await job.moveToFailed(new Error("Cancelled by user"), job.token);
      } else {
        await job.remove();
      }
  
      logger.info(`🗑️ Job ${jobId} successfully cancelled.`);
      return true;
    } catch (error) {
      let errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`❌ Error canceling job ID ${jobId}: ${errorMessage}`);
      return false;
    }
  }
  
  

  /**
   * ✅ Retry a failed job.
   * @param jobId - The job ID.
   * @returns True if retried, otherwise false.
   */
  public async retryJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.queue.getJob(jobId);
      if (!job) {
        logger.warn(`⚠️ Job ${jobId} not found.`);
        return false;
      }
  
      const state = await job.getState();
      if (state !== 'failed') {
        logger.warn(`⚠️ Job ${jobId} is not in a failed state.`);
        return false;
      }
      logger.info(`🔄 Retrying job ${jobId}...`);
      await job.retry();
      return true;
    } catch (error) {
      logger.error(`❌ Could not retry job ${jobId}:`, error);
      return false;
    }
  }
  


  public async clearQueue(): Promise<void> {
    await this.queue.drain();
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected createWorker(): Worker {
    logger.info('🔄 Creating a new worker instance...');
    
    return new Worker(
      config.queueName,
      async (job) => {
        try {
          logger.info(`🛠️ Worker picked up job ${job.id} with data: ${JSON.stringify(job.data)}`);
  
          await this.delay(config.pollInterval);
  
          logger.info(`✅ Job ${job.id} completed.`);
          return { success: true };
  
        } catch (error: unknown) {
          let errorMessage = 'Unknown error occurred';
  
          if (error instanceof Error) {
            errorMessage = error.message;
          } else if (typeof error === 'string') {
            errorMessage = error;
          }
  
          logger.error(`❌ Error processing job ${job.id}: ${errorMessage}`, { jobId: job.id, jobData: job.data });
          throw new Error(`Failed to process job ${job.id}: ${errorMessage}`);
        }
      },
      {
        connection: this.redisConnection,
        concurrency: config.concurrency,
        limiter: {max: 1, duration: 15000}
      }
    );
  }
  
  public startWorker(): void {
    if (!this.worker) {
        logger.info('🚀 Starting worker manually...');
        this.worker = this.createWorker();
    } else {
        logger.info('✅ Worker is already running.');
    }
}

  /**
   * ✅ Register event listeners for job lifecycle monitoring.
   */
/**
 * ✅ Register event listeners for job lifecycle monitoring.
 */
private setupEventListeners(): void {
  this.queueEvents.on('completed', ({ jobId }) => {
    logger.info(`✅ Job ${jobId} successfully completed.`);
  });

  this.queueEvents.on('failed', ({ jobId, failedReason }) => {
    logger.error(`❌ Job ${jobId} failed. Error: ${failedReason}`);
  });

  this.queueEvents.on('stalled', ({ jobId }) => {
    logger.warn(`⚠️ Job ${jobId} has stalled and will be retried.`);
  });

  this.queueEvents.on('active', ({ jobId }) => {
    logger.info(`🛠️ Job ${jobId} is now active.`);
  });

  this.queueEvents.on('waiting', ({ jobId }) => {
    logger.info(`⏳ Job ${jobId} is waiting to be processed.`);
  });

  this.queueEvents.on('progress', ({ jobId, data }) => {
    logger.info(`⏳ Job ${jobId} is ${data}% complete.`);
  });

  logger.info('📢 Queue event listeners initialized.');
}

  /**
   * ✅ Gracefully shut down queue and workers.
   */
  public async closeQueue(): Promise<void> {
    logger.info('🛑 Shutting down Queue & Worker...');
    
    this.queueEvents.removeAllListeners(); 
  
    await this.worker.close();
    await this.queue.close();
    await this.queueEvents.close();
    await this.redisConnection.quit();
  }
}
