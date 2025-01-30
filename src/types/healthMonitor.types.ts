export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    system: SystemMetrics;
    dependencies: DependencyStatus;
    application: ApplicationMetrics;
  }
  
  export interface SystemMetrics {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkStats: NetworkStats;
  }
  
  export interface DependencyStatus {
    [key: string]: {
      status: 'healthy' | 'unhealthy';
      latencyMs: number;
      lastChecked: string;
    };
  }
  
  export interface ApplicationMetrics {
    requestCount: number;
    averageResponseTime: number;
    errorRate: number;
  }
  
  export interface NetworkStats {
    uploadSpeed: number;
    downloadSpeed: number;
    activeConnections: number;
    latency: number;
  }
  
  export interface IHealthService {
    checkHealth(): Promise<HealthStatus>;
    getMetrics(): Promise<SystemMetrics>;
    checkDependencies(): Promise<DependencyStatus>;
  }
  