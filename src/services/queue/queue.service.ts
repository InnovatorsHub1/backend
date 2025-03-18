import { Queue, QueueEvents, Job, QueueOptions } from 'bullmq';
import IORedis from 'ioredis';
import { injectable } from 'inversify';
import { config } from '../../config';
import { WinstonLogger } from '@gateway/core/logger/winston.logger';
import {worker} from './workers.queue';

export enum JobState {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  SCHEDULED = 'scheduled',
  RETRYING = 'retrying',
  PRIORITIZED = 'prioritized'
}

const logger = new WinstonLogger('QueueService');

@injectable()
export class QueueService {
  protected queue: Queue;
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
  
    logger.info('✅ Queue Service initialized.');

    if (!worker) {
      logger.error('❌ Worker initialization failed.');
    } else {
      logger.info('🚀 Worker successfully linked to Queue Service.');
    }
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
    const jobOptions: {
      delay: number;
      priority: number;
      removeOnComplete: boolean;
      removeOnFail: boolean;
      attempts?: number;
      backoff?: { type: string; delay: number };
    } = {
      delay,
      priority,
      removeOnComplete: false,
      removeOnFail: false
    };

    // Check if this is a job that should fail
    if (typeof data === 'object' && data !== null && 'shouldFail' in data && (data as any).shouldFail) {
      jobOptions.attempts = 1;
      jobOptions.removeOnFail = false;
      logger.info(`⚠️ Configuring job to fail with single attempt`);
    } else {
      jobOptions.attempts = config.maxRetries;
      jobOptions.backoff = { type: 'fixed', delay: config.retryDelay };
    }

    // Get the job name from the data if it exists, otherwise use 'default'
    const jobName = typeof data === 'object' && data !== null && 'name' in data ? 
      (data as any).name : 'default';

    const job = await this.queue.add(jobName, data, jobOptions);

    if(!job){
      throw new Error('Failed to enqueue job');
    }
    return job;
  }

 /**
 * ✅ Remove a job from the queue before it starts processing.
 * @param jobId - The ID of the job to remove.
 * @returns True if successfully removed, otherwise false.
 */
public async dequeue(jobId: string): Promise<boolean> {
  try {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      logger.warn(`⚠️ Job ${jobId} not found.`);
      return false;
    }

    const jobState = await job.getState();

    const dequeableStates = ['waiting', 'delayed', 'prioritized']; 

    if (dequeableStates.includes(jobState)) {
      await job.remove();
      logger.info(`🗑️ Job ${jobId} successfully dequeued.`);
      return true;
    }

    logger.warn(`⚠️ Job ${jobId} is in state "${jobState}" and cannot be dequeued.`);
    return false;
  } catch (error) {
    logger.error(`❌ Error dequeuing job ${jobId}:`, error);
    return false;
  }
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
      let state = await job.getState();
      logger.info(`📊 Job ${jobId} state: ${state}`);

      if (state === 'prioritized' && job.attemptsMade >= config.maxRetries) {
        state = 'failed';
          
      }
    
      switch (state) {
        case 'completed': return JobState.COMPLETED;
        case 'failed': return JobState.FAILED;
        case 'waiting': return JobState.QUEUED;
        case 'active': return JobState.PROCESSING;
        case 'delayed': return JobState.SCHEDULED;
        case 'prioritized': return JobState.PRIORITIZED;
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
  public async retryJob(jobId: string): Promise<Job | null> {
    try {
      const job = await this.queue.getJob(jobId);
      if (!job) {
        logger.warn(`⚠️ Job ${jobId} not found.`);
        return null;
      }
  
      const state = await job.getState();
      if (state !== 'failed') {
        logger.warn(`⚠️ Job ${jobId} is not in a failed state.`);
        return null;
      }

      // Remove the old job
      await job.remove();

      // Create a new job with the same name, data, and options
      const jobOptions = {
        attempts: 1,
        removeOnComplete: false,
        removeOnFail: false, // keep failed jobs for debugging
      };


      // Create a new job with the same name and data
      const newJob = await this.queue.add(job.name, job.data, jobOptions);
      logger.info(`🔄 Job ${jobId} retried with new job ID ${newJob.id}`);
      return newJob;
    } catch (error) {
      let errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`❌ Error retrying job ID ${jobId}: ${errorMessage}`);
      return null;
    }
  }
  


  public async clearQueue(): Promise<void> {
    await this.queue.drain();
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
  
    await this.queue.close();
    await this.queueEvents.close();
    await this.redisConnection.quit();
  }

  async retry(jobId: string): Promise<boolean> {
    try {
      const job = await this.queue.getJob(jobId);
      if (!job) {
        logger.warn(`⚠️ Job ${jobId} not found for retry`);
        return false;
      }

      logger.info(`🔄 Retrying job ${jobId}`);
      await job.retry();
      return true;
    } catch (error) {
      logger.error(`❌ Error retrying job ${jobId}:`, error);
      return false;
    }
  }
}
