import request from 'supertest';
import { container } from '../../src/core/di/container';
import { App } from '../../src/app';
import { QueueService, JobState } from '../../src/services/queue.service';
import { TYPES } from '../../src/core/di/types';

let appInstance: App;
let server: any;
let queueService: QueueService;
let jobId: string;

beforeAll(async () => {
  process.env.PORT = '4000';
  appInstance = container.get<App>(TYPES.App);
  queueService = container.get<QueueService>(TYPES.QueueService);

  if (!queueService['worker']) {
    queueService.startWorker();
  }
  await appInstance.start();
  server = appInstance.getServer();

  await queueService.clearQueue();
});

afterAll(async () => {
  await queueService.clearQueue();

  if (queueService) {
    await queueService['queue'].pause(); 
    await queueService.clearQueue(); 
    await queueService['queue'].close(); 
    
    const queueEvents = queueService.getQueueEvents();
    queueEvents.removeAllListeners(); 
    await new Promise(resolve => setTimeout(resolve, 2000));
    await queueService.closeQueue();
  }

  if (appInstance) {
    console.log('🔄 Stopping App Server...');
    await appInstance.stop();
  }

  
});

/**
 * ✅ Wait for a job to complete before proceeding.
 */
async function waitForJobCompletion(jobId: string, queueService: QueueService): Promise<void> {
  return new Promise((resolve, reject) => {
    const queueEvents = queueService.getQueueEvents();

    queueEvents.once('completed', ({ jobId: completedJobId }) => {
      if (completedJobId === jobId) {
        console.log(`✅ Job ${jobId} completed.`);
        resolve();
      }
    });

    queueEvents.once('failed', ({ jobId: failedJobId, failedReason }) => {
      if (failedJobId === jobId) {
        console.error(`❌ Job ${jobId} failed: ${failedReason}`);
        reject(new Error(`Job ${jobId} failed: ${failedReason}`));
      }
    });

    setTimeout(() => {
      reject(new Error(`⏳ Job ${jobId} timeout - did not complete.`));
    }, 10000); // ⏳ Fail test if job takes longer than 10 seconds
  });
}


describe('Queue System Tests', () => {
  it('✅ Should enqueue a job and process it', async () => {
    const response = await request(server)
      .post('/api/queue/enqueue')
      .send({ task: 'process-video' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('jobId');

    jobId = response.body.jobId;
  });

  it('✅ Should retrieve job status', async () => {
    const response = await request(server).get(`/api/queue/status/${jobId}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status');
    expect(Object.values(JobState)).toContain(response.body.status);
  });

  it('✅ Should retry a failed job', async () => {
    await queueService['queue'].pause();
  
    const job = await queueService.enqueue({ task: 'force-fail' });
  
    await new Promise(resolve => setTimeout(resolve, 2000));
  
    const jobState = await job.getState();
  
    if (jobState !== 'active' && job.token) {
      await job.updateProgress(50);
      await new Promise(resolve => setTimeout(resolve, 500));
      await job.moveToFailed(new Error('Simulated failure'), job.token);
    } else if (job.token) {
      await job.moveToFailed(new Error('Simulated failure'), job.token);
    }
  
    if (!job.id) {
      throw new Error(`❌ Job ID is undefined. Job details: ${JSON.stringify(job)}`);
    }
  
    const jobStatus = await queueService.getJobStatus(job.id);
    expect(jobStatus).toBe(JobState.FAILED);
  
    const success = await queueService.retryJob(job.id);
    expect(success).toBe(true);
  
    await new Promise(resolve => setTimeout(resolve, 500));
  
    const retriedStatus = await queueService.getJobStatus(job.id);
    expect([JobState.PROCESSING, JobState.COMPLETED]).toContain(retriedStatus);
  
    await queueService['queue'].resume();
  });
  
  

  it('✅ Should cancel a queued job', async () => {
    const job = await queueService.enqueue({ task: 'cancel-this' });

    await new Promise(resolve => setTimeout(resolve, 500));

    if (job.id) {
      const success = await queueService.cancelJob(job.id);
      expect(success).toBe(true);
    } else {
      throw new Error('Job ID is undefined');
    }
  });

  it('✅ Should return 404 when retrying a non-existent job', async () => {
    const response = await request(server)
      .post(`/api/queue/retry/invalid-job-id`);

    expect(response.status).toBe(404);
  });

  it('✅ Should handle 1000 concurrent job enqueues (Load Test)', async () => {
    await queueService['queue'].pause(); 
    const jobPromises = [];
    for (let i = 0; i < 1000; i++) {
      jobPromises.push(queueService.enqueue({ task: `load-task-${i}` }));
    }
    await Promise.all(jobPromises); 
    await new Promise(resolve => setTimeout(resolve, 500));

    await queueService['queue'].resume();
    queueService['worker'].opts.concurrency = 10;
    const waitingJobs = await queueService['queue'].getWaiting(); 
    const delayedJobs = await queueService['queue'].getDelayed();
    console.log(`📊 Jobs waiting: ${waitingJobs.length}, Delayed: ${delayedJobs.length}`);  
    expect(waitingJobs.length + delayedJobs.length).toBe(1000);
  
    await Promise.all([...waitingJobs, ...delayedJobs].map(job => waitForJobCompletion(job.id, queueService))); 
  }, 120000);

  it('✅ Should clear the queue', async () => {
    await queueService.clearQueue();
    const waitingJobs = await queueService['queue'].getWaiting();
    expect(waitingJobs.length).toBe(0);
  });
});
