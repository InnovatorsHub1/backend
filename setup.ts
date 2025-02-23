import { MongoClient } from 'mongodb';

// Increase timeout for all tests
jest.setTimeout(30000);

// Clean up any mocks after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});

// Global teardown after all tests
afterAll(async () => {
  // Close any open handles
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Clean up MongoDB connections if any test forgot to close them
  const client = (global as any).mongoClient;
  if (client instanceof MongoClient) {
    await client.close();
  }
});