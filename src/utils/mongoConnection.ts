import { WinstonLogger } from '@gateway/core/logger/winston.logger';
import { MongoClient } from 'mongodb';

export interface IMongoConnection {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getClient(): MongoClient;
}

class MongoConnection implements IMongoConnection {
  private client: MongoClient | null = null;
  private logger = new WinstonLogger('MongoDB');
  private static instance: MongoConnection;

  async connect(): Promise<void> {
    try {
      this.client = await MongoClient.connect(process.env.MONGO_URI!);
      this.logger.info('Connected to MongoDB');
    } catch (error) {
      this.logger.error('MongoDB connection failed', error);
      throw error;
    }
  }

  static getInstance(): MongoConnection {
    if (!this.instance) {
      this.instance = new MongoConnection();
    }
    return this.instance;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
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

export const mongoConnection = new MongoConnection();