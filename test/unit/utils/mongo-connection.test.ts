import { MongoClient } from 'mongodb';
import { MongoConnection, getMongoConnection } from '../../../src/utils/mongoConnection';
import { WinstonLogger } from '@gateway/core/logger/winston.logger';

// Mock mongodb
jest.mock('mongodb');
const MockedMongoClient = MongoClient as jest.MockedClass<typeof MongoClient>;

// Mock winston logger
jest.mock('@gateway/core/logger/winston.logger');
const MockedWinstonLogger = WinstonLogger as jest.MockedClass<typeof WinstonLogger>;

describe('MongoConnection', () => {
    let mongoConnection: MongoConnection;
    let mockLogger: jest.Mocked<WinstonLogger>;
    let mockClient: jest.Mocked<MongoClient>;

  beforeEach(() => {
    // Reset the singleton instance
    // @ts-ignore: Accessing private static field for testing
    MongoConnection.instance = undefined;

    // Clear all mocks
    jest.clearAllMocks();

    // Setup mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<WinstonLogger>;
    MockedWinstonLogger.mockImplementation(() => mockLogger);

    // Setup mock client
    mockClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<MongoClient>;
    MockedMongoClient.mockImplementation(() => mockClient);

    // Set environment variable
    process.env.MONGO_URI = 'mongodb://localhost:27017';

    // Get fresh instance
    mongoConnection = getMongoConnection();
  });

  afterEach(() => {
    delete process.env.MONGO_URI;
  });



  describe('Singleton Pattern', () => {
    it('should create only one instance', () => {
      const instance1 = getMongoConnection();
      const instance2 = getMongoConnection();
      const instance3 = MongoConnection.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBe(instance3);
    });

    it('should maintain the same instance after connecting', async () => {
      const instance1 = getMongoConnection();
      await instance1.connect();
      
      const instance2 = getMongoConnection();
      expect(instance2.isConnected()).toBe(true);
      expect(instance1).toBe(instance2);
    });

  
  });

  describe('connect', () => {
   

    it('should handle connection failure', async () => {
      const error = new Error('Connection failed');
      mockClient.connect.mockRejectedValueOnce(error);

      await expect(mongoConnection.connect()).rejects.toThrow('Connection failed');
      expect(mockLogger.error).toHaveBeenCalledWith('MongoDB connection failed', error);
    });

   
  });

  describe('disconnect', () => {
    it('should disconnect successfully when client exists', async () => {
      // First connect
      await mongoConnection.connect();
      
      // Then disconnect
      mockClient.close.mockResolvedValueOnce(undefined);
      const consoleSpy = jest.spyOn(console, 'log');
      await mongoConnection.disconnect();

      expect(mockClient.close).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Disconnected from MongoDB');
      consoleSpy.mockRestore();
    });

    it('should handle disconnect when no client exists', async () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      await mongoConnection.disconnect();

      expect(mockClient.close).not.toHaveBeenCalled();
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle disconnect error', async () => {
      await mongoConnection.connect();
      
      const error = new Error('Disconnect failed');
      mockClient.close.mockRejectedValueOnce(error);

      await expect(mongoConnection.disconnect()).rejects.toThrow('Disconnect failed');
    });
  });

  describe('isConnected', () => {
    it('should return true when client exists', async () => {
      await mongoConnection.connect();
      expect(mongoConnection.isConnected()).toBe(true);
    });

    it('should return false when no client exists', () => {
      expect(mongoConnection.isConnected()).toBe(false);
    });

    it('should return false after disconnection', async () => {
        await mongoConnection.connect();
        
        // Mock the close method to properly set client to null
        mockClient.close.mockImplementationOnce(async () => {
          // @ts-ignore: Accessing private field for testing
          mongoConnection.client = null;
          return undefined;
        });
        
        await mongoConnection.disconnect();
        expect(mongoConnection.isConnected()).toBe(false);
      });
  });

  describe('getClient', () => {
    it('should return client when initialized', async () => {
      await mongoConnection.connect();
      
      const client = mongoConnection.getClient();
      expect(client).toBe(mockClient);
    });

    it('should throw error when client is not initialized', () => {
      expect(() => mongoConnection.getClient())
        .toThrow('MongoClient is not initialized');
    });

    it('should return same client instance on multiple calls', async () => {
      await mongoConnection.connect();
      
      const client1 = mongoConnection.getClient();
      const client2 = mongoConnection.getClient();
      expect(client1).toBe(client2);
    });
  });
});