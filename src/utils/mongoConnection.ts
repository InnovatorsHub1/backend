import { WinstonLogger } from '@gateway/core/logger/winston.logger';
import { MongoClient } from 'mongodb';

export interface IMongoConnection {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getClient(): MongoClient;
}

export class MongoConnection implements IMongoConnection {
  private client: MongoClient | null = null;
  private logger = new WinstonLogger('MongoDB');
  private static instance: MongoConnection;

  private constructor() { } // Make constructor private for singleton pattern

  async connect(): Promise<void> {
    try {
      console.log(process.env.MONGO_URI);
      this.client = new MongoClient(process.env.MONGO_URI!);
      await this.client.connect();
      console.log('success');
      this.logger.info('Connected to MongoDB');
    } catch (error) {
      this.logger.error('MongoDB connection failed', error);
      throw error;
    }
  }

  static getInstance(): MongoConnection {
    if (!MongoConnection.instance) {
      MongoConnection.instance = new MongoConnection();
    }
    return MongoConnection.instance;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      console.log('Disconnected from MongoDB');
    }
  }

  isConnected(): boolean {
    return !!this.client;
  }

  getClient(): MongoClient {
    if (!this.client) throw new Error('MongoClient is not initialized');
    return this.client;
  }
}

// Export the singleton instance getter
export const getMongoConnection = MongoConnection.getInstance;