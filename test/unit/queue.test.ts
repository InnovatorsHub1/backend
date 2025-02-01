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
  process.env.PORT = '0'; // Allow Jest to use a random available port
  appInstance = container.get<App>(TYPES.App);
  queueService = container.get<QueueService>(TYPES.QueueService);
  await appInstance.start();
  server = appInstance.getServer();
});

afterAll(async () => {
  await appInstance.stop();
});

describe('Queue System Tests', () => {
  it('✅ Should enqueue a job', async () => {
    const response = await request(server)
      .post('/api/queue/enqueue')
      .send({ task: 'process-video' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('jobId');

    jobId = response.body.jobId;
  });

  it('✅ Should retrieve job status', async () => {
    const response = await request(server)
      .get(`/api/queue/status/${jobId}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status');
    expect(Object.values(JobState)).toContain(response.body.status);
  });

  it('✅ Should retry a failed job', async () => {
    const success = await queueService.retryJob(jobId);
    expect(success).toBe(true);
  });

  it('✅ Should cancel a queued job', async () => {
    const response = await request(server)
      .post(`/api/queue/cancel/${jobId}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Job canceled');
  });

  it('✅ Should return 404 when retrying a non-existent job', async () => {
    const response = await request(server)
      .post(`/api/queue/retry/invalid-job-id`);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Job not found');
  });

  it('✅ Should clear the queue', async () => {
    await queueService.clearQueue();
    const waitingJobs = await queueService['queue'].getWaiting();
    expect(waitingJobs.length).toBe(0);
  });

  it('✅ Should handle 1000 concurrent job enqueues (Load Test)', async () => {
    const jobPromises = [];
    for (let i = 0; i < 1000; i++) {
      jobPromises.push(queueService.enqueue({ task: `load-task-${i}` }));
    }

    const jobs = await Promise.all(jobPromises);
    expect(jobs.length).toBe(1000);
  });

  it('✅ Should process jobs without failure', async () => {
    const activeJobs = await queueService['queue'].getActive();
    expect(activeJobs.length).toBeLessThan(10); // Controlled concurrency
  });
});
