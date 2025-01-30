import { resolve } from 'path';
import { WinstonLogger } from '../core/logger/winston.logger';
import { HealthStatus, SystemMetrics, DependencyStatus, ApplicationMetrics, NetworkStats, IHealthService } from '../types/healthMonitor.types';
import { injectable } from 'inversify';
import os from 'os';
import { rejects } from 'assert';
import { stdout } from 'process';
import { exec } from 'child_process';
import { mongoConnection } from '@gateway/utils/mongoConnection';
import { HEALTH_CONFIG } from '../config/health_config' ;
import { time } from 'console';


function getOS(): string {
    return os.platform()
}
//MacOS/LinuxOS
function getDiskUsageUnix(path: string): Promise<number> {
    return new Promise((resolve, rejects) => {
        exec(`df -h ${path} | tail -n 1 | awk '{print $5}' `, (err, stdout) => {
            if (err) return rejects(err);
            const usage = parseInt(stdout.replace('%', '').trim());
            resolve(usage);
        });
    });
}
//Windows 
function getDiskUsageWin(path: string): Promise<number> {
    return new Promise((resolve, rejects) => {
        exec(`wmic logicaldisk where "DeviceID='${path}'" get FreeSpace, Size`, (err, stdout) => {
            if (err) return rejects(err);
            const lines = stdout.split('\n');
            const sizeLine = lines[1].trim().split(/\s+/);
            const totalSpace = parseInt(sizeLine[1], 10);
            const freeSpace = parseInt(sizeLine[0], 10);
            const usedSpace = totalSpace - freeSpace;
            const usagePercentage = (usedSpace / totalSpace) * 100;

            resolve(usagePercentage);
        })
    })
}

@injectable()
export class HealthMonitor {
    private logger = new WinstonLogger('HealthService');

    //Cpu Usage
    private getCpuUsage(): number {
        return os.loadavg()[0];
    }
    //Memory Usage
    private getMemoryUsage(): number {
        const memory = process.memoryUsage();
        return memory.heapUsed;
    }
    //Disk Usage
    private getDiskUsage(path: string): Promise<number> {
        return new Promise(async (resolve, reject) => {
            const platform = getOS();
            if(platform === 'win32')
                return await getDiskUsageWin(path);
            else if (platform === 'linux' || platform === 'darwin')
                return await getDiskUsageUnix(path);
            else
                throw new Error('Unsupported Operating System');
        })
    }
    private async getNetworkStats(): Promise<NetworkStats> {
        const interfaces = os.networkInterfaces();
        const activeConnections = Object.keys(interfaces).length;
        const uploadSpeed = 10; //Mock value
        const downloadSpeed = 10; //Mock value
        const latency = 10 //Mock value
        return { uploadSpeed, downloadSpeed, activeConnections, latency };
    }
    private checkThreshold(metricName: string, value: number, threshold: number): void {
        if (value >= threshold) {
            this.logger.warn(`${metricName} exceeded threshold`, {
                current: value,
                threshold: threshold,
                timestamp: new Date().toISOString()
            });
        }
    }
    async checkSystem(): Promise<SystemMetrics> {
        this.logger.info('Performing System check');
        const cpuUsage = this.getCpuUsage();
        const memoryUsage = this.getMemoryUsage();
        const diskUsage = await this.getDiskUsage('/');
        const networkStats = await this.getNetworkStats();

        this.checkThreshold('CPU Usage', cpuUsage, HEALTH_CONFIG.alertThresholds.cpu);
        this.checkThreshold('Memory Usage', memoryUsage, HEALTH_CONFIG.alertThresholds.memory);
        this.checkThreshold('Disk Usage', diskUsage, HEALTH_CONFIG.alertThresholds.disk);
        this.checkThreshold('Latency', networkStats.latency, HEALTH_CONFIG.alertThresholds.responseTime);

        const metrics: SystemMetrics = {
            cpuUsage,
            memoryUsage,
            diskUsage,
            networkStats
        };

        return metrics;
    }
    async monitorDependecies(): Promise<DependencyStatus> {
        //checking db's connections:mongo,redis
        //checking extranal API calls

        const dependencies: DependencyStatus = {};
        try {
            const startTime = Date.now();
            const client = mongoConnection.getClient();
            await Promise.race([
                client.db().command({ ping: 1 }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Ping timeout')), 
                    HEALTH_CONFIG.dependencies.database.timeout)
                )
            ]);
            
            const endTime = Date.now();
            const latencyMs = endTime - startTime;
            dependencies.mongodb = {
                status: 'healthy',
                latencyMs : latencyMs,
                lastChecked: new Date().toISOString()

            }
            this.logger.info('MongoDB health check passed');
        }
        catch(error){
            const errorMsg = error instanceof Error ? error.message: 'Unknown error';
            dependencies.mongodb = {
                status: 'unhealthy',
                latencyMs : 0,
                lastChecked: new Date().toISOString()
            }
            this.logger.info('MongoDB health check failed',{
                error: errorMsg
            });
        }
        return dependencies;
    }
    async collectMetrics(): Promise<> {

    }
}