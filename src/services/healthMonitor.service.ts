import { resolve } from 'path';
import { WinstonLogger } from '../core/logger/winston.logger';
import { HealthStatus, SystemMetrics, DependencyStatus, ApplicationMetrics, NetworkStats, IHealthService } from '../types/healthMonitor.types';
import { injectable } from 'inversify';
import os from 'os';
import { rejects } from 'assert';
import { stdout } from 'process';
import { exec } from 'child_process';

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
    getCpuUsage(): number {
        return os.loadavg()[0];
    }
    //Memory Usage
    getMemoryUsage(): number {
        const memory = process.memoryUsage();
        return memory.heapUsed;
    }
    //Disk Usage
    getDiskUsage(path: string): Promise<number> {
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
    async getNetworkStats(): Promise<NetworkStats> {
        const interfaces = os.networkInterfaces();
        const activeConnections = Object.keys(interfaces).length;
        const uploadSpeed = 10; //Mock value
        const downloadSpeed = 10; //Mock value
        const latency = 10 //Mock value
        return { uploadSpeed, downloadSpeed, activeConnections, latency };
    }
    async checkSystem(): Promise<SystemMetrics> {
        this.logger.info('Performing System check');
        const cpuUsage = this.getCpuUsage();
        const memoryUsage = this.getMemoryUsage();
        const diskUsage = await this.getDiskUsage('/');
        const networkStats = this.getNetworkStats();
        return {
            cpuUsage,
            memoryUsage,
            diskUsage,
            networkStats
        }


    }
    async monitorDependecies(): Promise<> {
        //checking db's connections:mongo,redis
        //checking extranal API calls
    }
    async collectMetrics(): Promise<> {

    }
}