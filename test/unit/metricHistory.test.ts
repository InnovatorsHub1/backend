import { WinstonLogger } from "@gateway/core/logger/winston.logger";
import { Container } from "inversify";
import { Db, Collection, InsertOneResult, ObjectId } from "mongodb";
import { MetricsHistoryService } from "@gateway/services/metricHistory.service";
import { MetricsRecord, DependencyStatus } from '@gateway/types/metricHistory.types';

describe('MetricsHistoryService', () => {
    let service: MetricsHistoryService;
    let mockDb: jest.Mocked<Db>;
    let mockCollection: jest.Mocked<Collection>;
    let mockLogger: jest.Mocked<WinstonLogger>;
    let container: Container;
  
    const mockMetrics: MetricsRecord = {
      timestamp: new Date(),
      systemMetrics: {
        cpuUsage: 50,
        memoryUsage: 60,
        diskUsage: 70,
        networkStats: {
          uploadSpeed: 1000,
          downloadSpeed: 2000,
          activeConnections: 100,
          latency: 50
        }
      },
      dependencyStatus: {
        'database': {
          status: 'healthy',
          latencyMs: 50,
          lastChecked: new Date().toISOString()
        },
        'cache': {
          status: 'healthy',
          latencyMs: 20,
          lastChecked: new Date().toISOString()
        }
      },
      alerts: []
    };

  beforeAll(() => {
    container = new Container();
  });

  beforeEach(() => {
    mockCollection = {
      insertOne: jest.fn(),
      insertMany: jest.fn(),
      deleteMany: jest.fn(),
      find: jest.fn(),
      aggregate: jest.fn()
    } as unknown as jest.Mocked<Collection>;

    mockDb = {
      collection: jest.fn().mockReturnValue(mockCollection)
    } as unknown as jest.Mocked<Db>;

    mockLogger = {
      error: jest.fn()
    } as unknown as jest.Mocked<WinstonLogger>;

    service = new MetricsHistoryService(mockDb, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    container.unbindAll();
  });

  describe('saveMetrics', () => {
    it('should successfully save metrics and perform cleanup', async () => {
      const mockInsertResult: InsertOneResult<Document> = {
        acknowledged: true,
        insertedId: new ObjectId() // MongoDB ObjectId will be here in real scenario
      };

      mockCollection.insertOne.mockResolvedValueOnce(mockInsertResult);
      mockCollection.aggregate.mockReturnValueOnce({
        toArray: jest.fn().mockResolvedValueOnce([])
      } as any);
      mockCollection.deleteMany.mockResolvedValueOnce({ 
        acknowledged: true,
        deletedCount: 1 
    });

      await service.saveMetrics(mockMetrics);

      expect(mockDb.collection).toHaveBeenCalledWith('metrics_history');
      expect(mockCollection.insertOne).toHaveBeenCalledWith(mockMetrics);
      expect(mockCollection.deleteMany).toHaveBeenCalled();
    });

    it('should handle database errors appropriately', async () => {
      const error = new Error('Database error');
      mockCollection.insertOne.mockRejectedValueOnce(error);

      await expect(service.saveMetrics(mockMetrics)).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to save metrics', { error });
    });
  });

  describe('getMetricsHistory', () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-02');

    it('should retrieve raw metrics correctly', async () => {
      const mockMetricsArray = [mockMetrics];
      mockCollection.find.mockReturnValueOnce({
        sort: jest.fn().mockReturnValueOnce({
          toArray: jest.fn().mockResolvedValueOnce(mockMetricsArray)
        })
      } as any);

      const result = await service.getMetricsHistory(startDate, endDate, 'raw');

      expect(mockDb.collection).toHaveBeenCalledWith('metrics_history');
      expect(result).toEqual(mockMetricsArray);
    });

    it('should retrieve aggregated metrics correctly', async () => {
      const mockAggregatedMetrics = [{
        ...mockMetrics,
        avgCpuUsage: 45,
        avgMemoryUsage: 55
      }];

      mockCollection.find.mockReturnValueOnce({
        sort: jest.fn().mockReturnValueOnce({
          toArray: jest.fn().mockResolvedValueOnce(mockAggregatedMetrics)
        })
      } as any);

      const result = await service.getMetricsHistory(startDate, endDate, 'hourly');

      expect(mockDb.collection).toHaveBeenCalledWith('metrics_aggregated');
      expect(result).toHaveLength(1);
    });
  });
  describe('analyzeMetricsTrends', () => {
    it('should return empty trends analysis initially', async () => {
      const result = await service.analyzeMetricsTrends();

      expect(result).toEqual({
        anomalies: [],
        trends: []
      });
    });
  });

  describe('aggregateOldMetrics', () => {
    it('should aggregate metrics correctly', async () => {
      const mockAggregationResult = [{
        _id: {
          year: 2024,
          month: 1,
          day: 1,
          hour: 12
        },
        avgCpuUsage: 45,
        avgMemoryUsage: 55,
        avgDiskUsage: 65,
        maxCpuUsage: 75,
        alertCount: 2
      }];

      mockCollection.aggregate.mockReturnValueOnce({
        toArray: jest.fn().mockResolvedValueOnce(mockAggregationResult)
      } as any);

      // Using private method through any type for testing
      await (service as any).aggregateOldMetrics();

      expect(mockCollection.aggregate).toHaveBeenCalled();
      expect(mockCollection.insertMany).toHaveBeenCalledWith(mockAggregationResult);
    });
  });

  describe('cleanupOldMetrics', () => {
    it('should delete metrics older than retention period', async () => {
      mockCollection.deleteMany.mockResolvedValueOnce({
        acknowledged: true,
        deletedCount: 1
      });
  
      await (service as any).cleanupOldMetrics();
      expect(mockCollection.deleteMany).toHaveBeenCalled();
      expect(mockCollection.deleteMany.mock.calls[0][0]).toHaveProperty('timestamp.$lt');
    });
  });
});