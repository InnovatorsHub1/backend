import { SystemMetrics } from './healthMonitor.types';
import { DependencyStatus } from './healthMonitor.types';

export interface MetricsRecord {
  timestamp: Date;
  systemMetrics: SystemMetrics;
  dependencyStatus: DependencyStatus;
  alerts?: Alert[];
}

export interface Alert {
  type: 'cpu' | 'memory' | 'disk' | 'network' | 'dependency';
  severity: 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
}

export interface MetricsTrends {
  anomalies: Array<{
    metric: string;
    value: number;
    timestamp: Date;
  }>;
  trends: Array<{
    metric: string;
    trend: 'increasing' | 'decreasing';
    rate: number;
  }>;
}

export const metricsSchema = {
  timestamp: { type: Date, required: true, index: true },
  systemMetrics: {
    cpuUsage: Number,
    memoryUsage: Number,
    diskUsage: Number,
    networkStats: {
      uploadSpeed: Number,
      downloadSpeed: Number,
      activeConnections: Number,
      latency: Number
    }
  },
  dependencyStatus: {
    mongodb: {
      status: String,
      latencyMs: Number,
      lastChecked: Date
    }
  },
  alerts: [{
    type: String,
    severity: String,
    message: String,
    value: Number,
    threshold: Number,
    timestamp: Date
  }]
};