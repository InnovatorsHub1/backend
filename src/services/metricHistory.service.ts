// src/services/metrics/metricsHistory.service.ts

import { WinstonLogger } from "@gateway/core/logger/winston.logger";
import { inject, injectable } from "inversify";
import { Db } from "mongodb";
import { MetricsRecord, MetricsTrends } from '../types/metricHistory.types'

@injectable()
export class MetricsHistoryService {
  private readonly RETENTION_DAYS = 30;
  private readonly AGGREGATION_INTERVALS = {
    HOURLY: 60 * 60 * 1000,
    DAILY: 24 * 60 * 60 * 1000
  };

  constructor(
    @inject('DbConnection') private db: Db,
    private logger: WinstonLogger
  ) {}

  async saveMetrics(metrics: MetricsRecord): Promise<void> {
    try {
      await this.db.collection('metrics_history').insertOne(metrics);
      await this.aggregateOldMetrics();
      await this.cleanupOldMetrics();
    } catch (error) {
      this.logger.error('Failed to save metrics', { error });
      throw error;
    }
  }

  private async aggregateOldMetrics(): Promise<void> {
    const hourlyAggregation = [
      {
        $match: {
          timestamp: {
            $lt: new Date(Date.now() - this.AGGREGATION_INTERVALS.HOURLY),
            $gt: new Date(Date.now() - this.AGGREGATION_INTERVALS.DAILY)
          }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$timestamp" },
            month: { $month: "$timestamp" },
            day: { $dayOfMonth: "$timestamp" },
            hour: { $hour: "$timestamp" }
          },
          avgCpuUsage: { $avg: "$systemMetrics.cpuUsage" },
          avgMemoryUsage: { $avg: "$systemMetrics.memoryUsage" },
          avgDiskUsage: { $avg: "$systemMetrics.diskUsage" },
          maxCpuUsage: { $max: "$systemMetrics.cpuUsage" },
          alertCount: { $sum: { $size: "$alerts" } }
        }
      }
    ];

    await this.db.collection('metrics_aggregated').insertMany(
      await this.db.collection('metrics_history')
        .aggregate(hourlyAggregation).toArray()
    );
  }

  private async cleanupOldMetrics(): Promise<void> {
    const cutoffDate = new Date(Date.now() - (this.RETENTION_DAYS * 24 * 60 * 60 * 1000));
    await this.db.collection('metrics_history').deleteMany({
      timestamp: { $lt: cutoffDate }
    });
  }

  async getMetricsHistory(
    startDate: Date,
    endDate: Date,
    resolution: 'raw' | 'hourly' | 'daily' = 'raw'
  ): Promise<MetricsRecord[]> {
    const collection = resolution === 'raw' ? 'metrics_history' : 'metrics_aggregated';
    
    const documents = await this.db.collection(collection)
      .find({
        timestamp: {
          $gte: startDate,
          $lte: endDate
        }
      })
      .sort({ timestamp: 1 })
      .toArray();

    return documents.map(doc => ({
      ...doc,
      timestamp: new Date(doc.timestamp),
      systemMetrics: doc.systemMetrics,
      dependencyStatus: doc.dependencyStatus,
      alerts: doc.alerts
    }));
  }

  async analyzeMetricsTrends(): Promise<MetricsTrends> {
    // Implementation of trend analysis using statistical methods
    return {
      anomalies: [],
      trends: []
    };
  }
}