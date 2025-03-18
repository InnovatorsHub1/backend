import request from 'supertest';
import { container } from '../../src/core/di/container';
import { App } from '../../src/app';
import { QueueService, JobState } from '../../src/services/queue/queue.service';
import { TYPES } from '../../src/core/di/types';
import { Application } from 'express';


describe('Queue System Tests', () => {
  let appInstance: App;
  let server: Application;
  let queueService: QueueService;
  let jobId: string;

  beforeAll(async () => {
    jest.setTimeout(60000); // Set timeout for all tests in this suite
    process.env.PORT = '4000';
    appInstance = container.get<App>(TYPES.App);
    queueService = container.get<QueueService>(TYPES.QueueService);
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

  it('✅ Should enqueue a job and process it', async () => {
    const response = await request(server)
      .post('/api/queue/enqueue')
      .send({ task: 'process-video' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('jobId');

    jobId = response.body.jobId;
  });

  it('✅ Should dequeue a queued job', async () => {
    // Pause the queue before adding the job
    await queueService['queue'].pause();
    
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
    
    // Resume the queue after test
    await queueService['queue'].resume();
  });

  it('✅ Should retrieve job status', async () => {
    const response = await request(server).get(`/api/queue/status/${jobId}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status');
    expect(Object.values(JobState)).toContain(response.body.status);
  });

  it('✅ Should retry a failed job correctly', async () => {
    await queueService['queue'].pause();
  
    // Enqueue the failing job
    const job = await queueService.enqueue({ name: 'fail', shouldFail: true });
    console.log(`📝 Added job ${job.id} to queue`);
  
    await queueService['queue'].resume();
    console.log('▶️ Queue resumed');
  
    // Expect job to fail:
    try {
      await job.waitUntilFinished(queueService.getQueueEvents(), 30000);
      // If the promise resolves, the job succeeded (unexpected here!)
      throw new Error(`❌ Job ${job.id} was supposed to fail but succeeded.`);
    } catch (error) {
      console.log(`✅ Job ${job.id} failed as expected.`);
    }
  
    // Verify the job failed
    let state = await job.getState();
    expect(state).toBe('failed');
  
    // Retry the job
    const retriedJob = await queueService.retryJob(job.id as string);
    expect(retriedJob).toBeDefined();
  
    // Wait for retried job to finish
  try {
    await retriedJob!.waitUntilFinished(queueService.getQueueEvents(), 30000);
    throw new Error('Retried job unexpectedly succeeded.');
  } catch {}

  const retriedState = await retriedJob!.getState();
  expect(retriedState).toBe('failed');
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

  it('✅ Should handle 1000 concurrent job enqueues and process them', async () => {
    jest.setTimeout(300000); // 5 minutes timeout
    
    // Clear any existing jobs first
    await queueService.clearQueue();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Add 1000 jobs to the queue
    const batchSize = 100;
    const totalJobs = 1000;
    const jobIds = [];
    
    console.log('🚀 Starting to enqueue jobs...');
    
    // Enqueue jobs in batches to prevent overwhelming Redis
    for (let i = 0; i < totalJobs; i += batchSize) {
      const batch = [];
      for (let j = 0; j < batchSize && (i + j) < totalJobs; j++) {
        batch.push(queueService.enqueue({ name: 'process', task: `load-task-${i + j}` }));
      }
      const jobs = await Promise.all(batch);
      jobIds.push(...jobs.map(job => job.id));
      console.log(`📦 Enqueued batch ${i / batchSize + 1}/${Math.ceil(totalJobs / batchSize)}`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay between batches
      jest.setTimeout(3000);
    }
    
    console.log(`✅ All ${totalJobs} jobs enqueued. Waiting for completion...`);
    
    // Wait for jobs to complete
    const maxWaitTime = 240000; // 4 minutes
    const startTime = Date.now();
    let lastLog = Date.now();
    const logInterval = 5000; // Log every 5 seconds
    
    while (Date.now() - startTime < maxWaitTime) {
      const activeJobs = await queueService['queue'].getActive();
      const completedJobs = await queueService['queue'].getCompleted();
      const failedJobs = await queueService['queue'].getFailed();
      const waitingJobs = await queueService['queue'].getWaiting();
      
      // Log status at intervals
      if (Date.now() - lastLog >= logInterval) {
        console.log(`📊 Status - Active: ${activeJobs.length}, Completed: ${completedJobs.length}, Failed: ${failedJobs.length}, Waiting: ${waitingJobs.length}`);
        lastLog = Date.now();
      }
      
      // Check if all jobs are processed
      const totalProcessed = completedJobs.length + failedJobs.length;
      if (activeJobs.length === 0 && waitingJobs.length === 0 && totalProcessed >= totalJobs) {
        // Add a small delay to ensure all jobs are fully processed
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Double check the final state
        const finalActiveJobs = await queueService['queue'].getActive();
        const finalCompletedJobs = await queueService['queue'].getCompleted();
        const finalFailedJobs = await queueService['queue'].getFailed();
        const finalWaitingJobs = await queueService['queue'].getWaiting();
        
        if (finalActiveJobs.length === 0 && finalWaitingJobs.length === 0 && 
            (finalCompletedJobs.length + finalFailedJobs.length) >= totalJobs) {
          break;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    const activeJobs = await queueService['queue'].getActive();
    const completedJobs = await queueService['queue'].getCompleted();
    const failedJobs = await queueService['queue'].getFailed();
    const waitingJobs = await queueService['queue'].getWaiting();
    
    console.log(`📈 Final Status - Active: ${activeJobs.length}, Completed: ${completedJobs.length}, Failed: ${failedJobs.length}, Waiting: ${waitingJobs.length}`);
    
    // Verify all jobs are processed
    expect(activeJobs.length).toBe(0);
    expect(waitingJobs.length).toBe(0);
    expect(completedJobs.length + failedJobs.length).toBeGreaterThanOrEqual(totalJobs);
    
    // Clean up
    await queueService.clearQueue();
  }, 300000); // 5 minutes timeout

  it('✅ Should clear the queue', async () => {
    await queueService.clearQueue();
    const waitingJobs = await queueService['queue'].getWaiting();
    expect(waitingJobs.length).toBe(0);
  });
});
