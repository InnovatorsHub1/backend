import { WinstonLogger } from '../core/logger/winston.logger';
import { SystemMetrics, DependencyStatus, NetworkStats, DependencyCheckResult} from '../types/healthMonitor.types';
import { injectable } from 'inversify';
import os from 'os';
import { exec } from 'child_process';
import { mongoConnection } from '@gateway/utils/mongoConnection';
import { HEALTH_CONFIG } from '../config/health.config';
import { MetricsHistoryService } from './metricHistory.service';
import { promisify } from 'util';

interface NetworkInterfaceStats {
    bytesReceived: number;
    bytesSent: number;
    timestamp: number;
}

@injectable()
export class HealthMonitorService {
    private lastStats: Map<string, NetworkInterfaceStats> = new Map();
    private execAsync = promisify(exec);
    
    constructor(
        private metricsHistory: MetricsHistoryService,
        private logger: WinstonLogger
    ) {}

    // Get CPU usage
    private getCpuUsage(): number {
        return os.loadavg()[0];
    }

    // Get Memory usage
    private getMemoryUsage(): number {
        return process.memoryUsage().heapUsed;
    }

    // Get Disk Usage based on OS
    private async getDiskUsage(path: string): Promise<number> {
        const platform = os.platform();
        return platform === 'win32' ? this.getDiskUsageWin(path) : this.getDiskUsageUnix(path);
    }

    private getDiskUsageUnix(path: string): Promise<number> {
        return new Promise((resolve, reject) => {
            exec(`df -h ${path} | tail -n 1 | awk '{print $5}'`, (err, stdout) => {
                if (err) return reject(err);
                resolve(parseInt(stdout.replace('%', '').trim()));
            });
        });
    }

    private getDiskUsageWin(path: string): Promise<number> {
        return new Promise((resolve, reject) => {
            exec(`wmic logicaldisk where "DeviceID='${path}'" get FreeSpace, Size`, (err, stdout) => {
                if (err) return reject(err);
                const lines = stdout.trim().split('\n');
                const [freeSpace, totalSpace] = lines[1]?.trim().split(/\s+/).map(Number) || [];
                resolve(((totalSpace - freeSpace) / totalSpace) * 100);
            });
        });
    }
    
    private async getWindowsNetworkStats(interfaceName: string): Promise<NetworkInterfaceStats> {
        try {
            const { stdout } = await this.execAsync(
                `powershell "Get-NetAdapterStatistics -Name '${interfaceName}' | Select-Object ReceivedBytes,SentBytes"`,
            );
            const [receivedLine, sentLine] = stdout.trim().split('\n').slice(2);
            return {
                bytesReceived: parseInt(receivedLine.trim()),
                bytesSent: parseInt(sentLine.trim()),
                timestamp: Date.now()
            };
        } catch {
            return { bytesReceived: 0, bytesSent: 0, timestamp: Date.now() };
        }
    }

    private async getLinuxNetworkStats(interfaceName: string): Promise<NetworkInterfaceStats> {
        try {
            const { stdout } = await this.execAsync(`cat /proc/net/dev | grep ${interfaceName}`);
            const stats = stdout.trim().split(/\s+/);
            return {
                bytesReceived: parseInt(stats[1]),
                bytesSent: parseInt(stats[9]),
                timestamp: Date.now()
            };
        } catch {
            return { bytesReceived: 0, bytesSent: 0, timestamp: Date.now() };
        }
    }
    
    public async getNetworkStats(): Promise<NetworkStats> {
        const interfaces = os.networkInterfaces();
        let totalUploadSpeed = 0;
        let totalDownloadSpeed = 0;

        for (const [interfaceName, interfaceData] of Object.entries(interfaces)) {
            if (!interfaceData?.some(addr => addr.family === 'IPv4')) continue;

            const currentStats = os.platform() === 'win32'
                ? await this.getWindowsNetworkStats(interfaceName)
                : await this.getLinuxNetworkStats(interfaceName);

            const lastStats = this.lastStats.get(interfaceName);
            if (lastStats) {
                const timeDiff = (currentStats.timestamp - lastStats.timestamp) / 1000;
                if (timeDiff > 0) {
                    totalUploadSpeed += (currentStats.bytesSent - lastStats.bytesSent) / timeDiff;
                    totalDownloadSpeed += (currentStats.bytesReceived - lastStats.bytesReceived) / timeDiff;
                }
            }
            this.lastStats.set(interfaceName, currentStats);
        }

        const [latency, activeConnections] = await Promise.all([
            this.measureLatency(),
            this.getActiveConnections()
        ]);

        return { uploadSpeed: totalUploadSpeed, downloadSpeed: totalDownloadSpeed, activeConnections, latency };
    }

    private async measureLatency(): Promise<number> {
        const host = 'www.google.com';
        const command = os.platform() === 'win32' ? `ping -n 1 ${host}` : `ping -c 1 ${host}`;
        try {
            const { stdout } = await this.execAsync(command);
            const match = stdout.match(/time=(\d+(\.\d+)?) ms/);
            return match ? parseFloat(match[1]) : 0;
        } catch {
            return 0;
        }
    }

    private async getActiveConnections(): Promise<number> {
        const command = os.platform() === 'win32' 
            ? 'netstat -n | find "ESTABLISHED" /c' 
            : 'netstat -n | grep ESTABLISHED | wc -l';
        try {
            const { stdout } = await this.execAsync(command);
            return parseInt(stdout.trim());
        } catch {
            return 0;
        }
    }

    private checkThreshold(metricName: string, value: number, threshold: number): void {
        if (value >= threshold) {
            this.logger.warn(`${metricName} exceeded threshold`, { current: value, threshold, timestamp: new Date().toISOString() });
        }
    }

    public async checkSystem(): Promise<SystemMetrics> {
        this.logger.info('Performing system check');
        const cpuUsage = this.getCpuUsage();
        const memoryUsage = this.getMemoryUsage();
        const diskUsage = await this.getDiskUsage('/');
        const networkStats = await this.getNetworkStats();

        this.checkThreshold('CPU Usage', cpuUsage, HEALTH_CONFIG.alertThresholds.cpu);
        this.checkThreshold('Memory Usage', memoryUsage, HEALTH_CONFIG.alertThresholds.memory);
        this.checkThreshold('Disk Usage', diskUsage, HEALTH_CONFIG.alertThresholds.disk);
        this.checkThreshold('Latency', networkStats.latency, HEALTH_CONFIG.alertThresholds.responseTime);

        const metrics: SystemMetrics = { cpuUsage, memoryUsage, diskUsage, networkStats };
        await this.metricsHistory.saveMetrics({
            timestamp: new Date(),
            systemMetrics: metrics,
            dependencyStatus: await this.monitorDependencies(),
            alerts: []
        });
        return metrics;
    }

     // Check MongoDB dependency health
     private async checkMongoDBHealth(): Promise<DependencyCheckResult> {
        try {
            const startTime = Date.now();
            await mongoConnection.getClient().db().command({ ping: 1 });
            const latencyMs = Date.now() - startTime;
            this.logger.info('MongoDB health check passed', { latencyMs });
            return { 
                status: 'healthy', 
                latencyMs, 
                lastChecked: new Date().toISOString() 
            };
        } catch (error) {
            this.logger.error('MongoDB health check failed', { error });
            return { 
                status: 'unhealthy', 
                latencyMs: 0, 
                lastChecked: new Date().toISOString(),
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    //Check Redis dependency health
    private async checkRedisHealth(): Promise<DependencyCheckResult> {
       
        try {
           
            // Placeholder return
            return { 
                status: 'healthy', 
                latencyMs: 0, 
                lastChecked: new Date().toISOString() 
            };
        } catch (error) {
            // this.logger.error('Redis health check failed', { error });
            return { 
                status: 'unhealthy', 
                latencyMs: 0, 
                lastChecked: new Date().toISOString(),
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    public async monitorDependencies(): Promise<DependencyStatus> {
        const dependencies: DependencyStatus = {};  
        // Uncomment when Redis check is implemented
        // const [mongoStatus, redisStatus]
        const [mongoStatus] = await Promise.all([
            this.checkMongoDBHealth(),
            // Uncomment when Redis check is implemented
            // this.checkRedisHealth(),
        ]);
        dependencies.mongodb = mongoStatus;
        // Uncomment when Redis check is implemented
        // dependencies.redis = redisStatus;
        return dependencies;
    }
}
