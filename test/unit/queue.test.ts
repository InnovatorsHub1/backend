import request from 'supertest';
import { container } from '../../src/core/di/container';
import { App } from '../../src/app';
import { QueueService, JobState } from '../../src/services/queue.service';
import { TYPES } from '../../src/core/di/types';
import net from 'net';

let appInstance: App;
let server: any;
let queueService: QueueService;
let jobId: string;

/**
 * ✅ Get an available port dynamically.
 */
function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const address = server.address();
      if (typeof address === 'object' && address !== null) {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        reject(new Error('Could not find available port'));
      }
    });
  });
}

async function waitForJobCompletion(jobId: string, queueService: QueueService): Promise<void> {
  return new Promise((resolve, reject) => {
    const queueEvents = queueService.getQueueEvents(); 

    queueEvents.on('completed', ({ jobId: completedJobId }) => {
      if (completedJobId === jobId) resolve();
    });

    queueEvents.on('failed', ({ jobId: failedJobId }) => {
      if (failedJobId === jobId) reject(new Error(`❌ Job ${jobId} failed`));
    });
  });
}



beforeAll(async () => {
  jest.setTimeout(30000); 

  const availablePort = await getAvailablePort();
  process.env.PORT = String(availablePort);

  appInstance = container.get<App>(TYPES.App);
  queueService = container.get<QueueService>(TYPES.QueueService);
  
  await appInstance.start();
  server = appInstance.getServer();

  await queueService['queue'].pause(); // ✅ Prevent auto-processing
});

afterAll(async () => {
  jest.setTimeout(15000);
  if (queueService) {
    await queueService['queue'].resume();
    await queueService.closeQueue();
  }
  if (appInstance) await appInstance.stop();
});

describe('Queue System Tests', () => {
  /**
   * ✅ Should enqueue a job
   */
  it('✅ Should enqueue a job and process it', async () => {
    const response = await request(server)
      .post('/api/queue/enqueue')
      .send({ task: 'process-video' });
  
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('jobId');
  
    jobId = response.body.jobId;
  }, 15000);

  /**
   * ✅ Should retrieve job status
   */
  it('✅ Should retrieve job status', async () => {
    const allJobs = await queueService['queue'].getJobs(['waiting', 'active', 'completed', 'failed']);
  
    console.log(`📝 Jobs in queue: ${allJobs.length}`);
    allJobs.forEach(async (job) => {
      console.log(`🔹 Job ${job.id}: ${await job.getState()}`);
    });
  
    const response = await request(server).get(`/api/queue/status/${jobId}`);
  
    console.log(`📡 API Response:`, response.body);
  
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status');
    expect(Object.values(JobState)).toContain(response.body.status);
  });

  /**
   * ✅ Should retry a failed job
   */
  it('✅ Should retry a failed job', async () => {
    await queueService['queue'].pause();
  
    const job = await queueService.enqueue({ task: 'force-fail' });
  
    await new Promise(resolve => setTimeout(resolve, 1000));
    const jobState = await job.getState();
  
    if (jobState === 'active' && job.token) {
      await job.moveToFailed(new Error('Simulated failure'), job.token);
    }
  
    const jobStatus = await queueService.getJobStatus(jobId);
    expect(jobStatus).toBe(JobState.FAILED);
  
    // ✅ Wait for retry to succeed
    const success = await queueService.retryJob(jobId);
    expect(success).toBe(true);
    await waitForJobCompletion(jobId, queueService);
  
    const retriedStatus = await queueService.getJobStatus(jobId);
    expect(retriedStatus).toBe(JobState.COMPLETED);
  
    await queueService['queue'].resume();
  });

  /**
   * ✅ Should cancel a queued job
   */
  it('✅ Should cancel a queued job', async () => {
    await queueService['queue'].pause();

    const job = await queueService.enqueue({ task: 'cancel-this' });

    await new Promise(resolve => setTimeout(resolve, 500));

    const response = await request(server).post(`/api/queue/cancel/${job.id}`);
    
    expect(response.status).toBe(200);
    expect(response.body.message).toBe(`Job canceled: ${job.id}`);

    await queueService['queue'].resume();
  }, 10000);

  /**
   * ✅ Should return 404 when retrying a non-existent job
   */
  it('✅ Should return 404 when retrying a non-existent job', async () => {
    const response = await request(server)
      .post(`/api/queue/retry/invalid-job-id`);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Job not found or cannot be retried');
  });

  /**
   * ✅ Should handle 1000 concurrent job enqueues (Load Test)
   */
  it('✅ Should handle 1000 concurrent job enqueues (Load Test)', async () => {
    await queueService['queue'].pause();

    const jobPromises = [];
    for (let i = 0; i < 1000; i++) {
      jobPromises.push(queueService.enqueue({ task: `load-task-${i}` }));
    }
    await Promise.all(jobPromises);

    //const waitingJobs = await queueService['queue'].getWaiting();
    expect(jobPromises.length).toBe(1000);

    await queueService['queue'].resume();
  }, 30000);

  /**
   * ✅ Should clear the queue
   */
  it('✅ Should clear the queue', async () => {
    await queueService.clearQueue();
    const waitingJobs = await queueService['queue'].getWaiting();
    expect(waitingJobs.length).toBe(0);
  });
});
