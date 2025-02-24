import request from 'supertest';
import { container } from '../../src/core/di/container';
import { App } from '../../src/app';
import { QueueService, JobState } from '../../src/services/queue/queue.service';
import { TYPES } from '../../src/core/di/types';

let appInstance: App;
let server: any;
let queueService: QueueService;
let jobId: string;

beforeAll(async () => {
  jest.setTimeout(30000);
  process.env.PORT = '4000';
  appInstance = container.get<App>(TYPES.App);
  queueService = container.get<QueueService>(TYPES.QueueService);
  await appInstance.start();
  server = appInstance.getServer();

  await queueService.clearQueue();
});

afterAll(async () => {
  jest.setTimeout(30000);
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

// /**
//  * ✅ Wait for a job to complete before proceeding.
//  */
// async function waitForJobCompletion(jobId: string, queueService: QueueService): Promise<void> {
//   return new Promise((resolve, reject) => {
//     const queueEvents = queueService.getQueueEvents();

//     queueEvents.once('completed', ({ jobId: completedJobId }) => {
//       if (completedJobId === jobId) {
//         console.log(`✅ Job ${jobId} completed.`);
//         resolve();
//       }
//     });

//     queueEvents.once('failed', ({ jobId: failedJobId, failedReason }) => {
//       if (failedJobId === jobId) {
//         console.error(`❌ Job ${jobId} failed: ${failedReason}`);
//         reject(new Error(`Job ${jobId} failed: ${failedReason}`));
//       }
//     });

//     setTimeout(() => {
//       reject(new Error(`⏳ Job ${jobId} timeout - did not complete.`));
//     }, 10000); // ⏳ Fail test if job takes longer than 10 seconds
//   });
// }


describe('Queue System Tests', () => {
  it('✅ Should enqueue a job and process it', async () => {
    const response = await request(server)
      .post('/api/queue/enqueue')
      .send({ task: 'process-video' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('jobId');

    jobId = response.body.jobId;
  });

  it('✅ Should dequeue a queued job', async () => {
    const job = await queueService.enqueue({ task: 'remove-this' });
  
    await new Promise(resolve => setTimeout(resolve, 1000));
    const jobState = await job.getState();
    console.log(`🔍 Job ${job.id} state before dequeue: ${jobState}`);

    if (['waiting', 'delayed', 'prioritized'].includes(jobState) && job.id) {
      const success = await queueService.dequeue(job.id as string);
      expect(success).toBe(true);
  
      const jobStatus = await queueService.getJobStatus(job.id as string);
      expect(jobStatus).toBe(null); 
    } else {
      throw new Error(`Job ${job.id} is in state ${jobState} and cannot be dequeued`);
    }
  });

  it('✅ Should retrieve job status', async () => {
    const response = await request(server).get(`/api/queue/status/${jobId}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status');
    expect(Object.values(JobState)).toContain(response.body.status);
  });

  it('✅ Should retry a failed job', async () => {
    jest.setTimeout(15000);
    await queueService['queue'].pause();
  
    const job = await queueService.enqueue({ task: 'force-fail' });
  
    await new Promise(resolve => setTimeout(resolve, 2000));
  

    let jobState = await job.getState();
    if (jobState === 'waiting') {
      console.log(`🔄 Moving job ${job.id} to active state before failure.`);
      await job.updateProgress(50); 
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  
    jobState = await job.getState();
    console.log(`🔍 Job state before failure: ${jobState}`);
    
    if (job.token) {
        await job.moveToFailed(new Error('Simulated failure'), job.token);
    }

    let maxRetries = 5;
    while (jobState !== 'failed' && maxRetries > 0) {
    await new Promise(resolve => setTimeout(resolve, 500)); // Wait before rechecking
    jobState = await job.getState();
    console.log(`🔍 Retrying check: Job state is now ${jobState}`);
    maxRetries--;
  }
    
    expect(jobState).toBe(JobState.FAILED);
    
    const success = await queueService.retryJob(job.id as string);
    expect(success).toBe(true);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    const retriedStatus = await queueService.getJobStatus(String(job.id));
    expect([JobState.PROCESSING, JobState.COMPLETED]).toContain(retriedStatus);
    
    await queueService['queue'].resume();
  },15000);
  
  

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

  it('✅ Should handle 100 concurrent job enqueues and process them', async () => {
    await queueService['queue'].pause(); 
    const jobPromises = [];

    for (let i = 0; i < 100; i++) {
      jobPromises.push(queueService.enqueue({ task: `load-task-${i}` }));
    }
    
    await Promise.all(jobPromises);
    await new Promise(resolve => setTimeout(resolve, 2000));

    await queueService['queue'].resume();
    await new Promise(resolve => setTimeout(resolve, 2000));
    // ✅ Wait for jobs to transition to processing
    let processingJobs;
    for (let attempt = 0; attempt < 20; attempt++) { 
        processingJobs = await queueService['queue'].getActive(); 
        if (processingJobs.length > 0) break;
        await new Promise(resolve => setTimeout(resolve, 1500)); 
    }

    // ✅ Wait for all jobs to complete
    const completedJobs = await queueService['queue'].getCompleted();
    console.log(`✅ Jobs completed: ${completedJobs.length}`);
    expect(completedJobs.length).toBe(103);}, 12000);


  it('✅ Should clear the queue', async () => {
    await queueService.clearQueue();
    const waitingJobs = await queueService['queue'].getWaiting();
    expect(waitingJobs.length).toBe(0);
  });
});
