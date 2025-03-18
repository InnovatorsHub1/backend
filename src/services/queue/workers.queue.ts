import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../../config';
import { WinstonLogger } from '@gateway/core/logger/winston.logger';

const logger = new WinstonLogger('QueueWorker');

declare global {
  var redisInstance: IORedis | undefined;
  var workerInstance: Worker | undefined;
}
// Ensure a single Redis connection
global.redisInstance = global.redisInstance || new IORedis(config.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Function to simulate a task with progress updates
async function runTaskWithProgress(job: Job, totalSteps: number) {
  for (let step = 1; step <= totalSteps; step++) {
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Calculate and update job progress
    const progress = Math.round((step / totalSteps) * 100);
    await job.updateProgress(progress);
    logger.info(`🔄 Job ${job.id} is ${progress}% complete.`);
  }
}

// Job processor function
async function processJob(job: Job) {
  try {
    logger.info(`🛠️ Processing job ${job.id} of type '${job.name || "default"}'`);

    const totalSteps = 5;

    switch (job.name) {
      case 'default':
      case 'process':
        logger.info(`📊 Starting ${job.name} task...`);
        await runTaskWithProgress(job, totalSteps);
        break;

      case 'fail':
        logger.info(`🔄 Processing fail task for job ${job.id}`);
        if (job.data.shouldFail) {
          logger.error(`❌ Job ${job.id} failed as requested`);
          throw new Error('Job failed as requested');
        }
        await runTaskWithProgress(job, totalSteps);
        break;

      default:
        logger.warn(`⚠️ Job ${job.id} has no recognized name. Processing as a generic job.`);
        await runTaskWithProgress(job, totalSteps);
        break;
    }

    logger.info(`✅ Job ${job.id} completed successfully.`);
    return { success: true };
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`❌ Error processing job ${job.id}: ${error.message}`);
      await job.updateProgress(0);
      throw error;
    }
    throw error;
  }
}

// Ensure a single worker instance
if (!global.workerInstance) {
  global.workerInstance = new Worker(
    config.queueName,
    async (job) => processJob(job),
    {
      connection: global.redisInstance,
      concurrency: 50,
      limiter: { max: 100, duration: 1000 },
    }
  );

  logger.info('🚀 Queue Worker started and listening for jobs.');

  // Event listeners to log worker events
  global.workerInstance.on('active', (job) => logger.info(`🚀 Job ${job.id} is now active.`));
  global.workerInstance.on('progress', (job) => logger.info(`🔄 Job ${job.id} progress: ${job.progress}% completed.`));
  global.workerInstance.on('completed', (job) => logger.info(`✅ Job ${job.id} COMPLETED!`));
  global.workerInstance.on('failed', (job, err) => {
    if (job && job.id && err) {
      logger.error(`❌ Job ${job.id} FAILED! Attempt ${job.attemptsMade}. Error: ${err.message}`);
    }
  });
}

export const worker = global.workerInstance;
