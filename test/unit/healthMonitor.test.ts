import { HealthMonitorService } from '@gateway/services/healthMonitor.service';
import { WinstonLogger } from '@gateway/core/logger/winston.logger';
import { mongoConnection } from '@gateway/utils/mongoConnection';
import { HEALTH_CONFIG } from '@gateway/config/health.config';
import { MetricsHistoryService } from '@gateway/services/metricHistory.service';
import os from 'os';
import * as child_process from 'child_process';

jest.mock('@gateway/core/logger/winston.logger');
jest.mock('@gateway/utils/mongoConnection');
jest.mock('os');
jest.mock('child_process');

describe('HealthMonitor', () => {
    let healthMonitor: HealthMonitorService;
    let mockLogger: jest.Mocked<WinstonLogger>;
    let mockMetricsHistory: jest.Mocked<MetricsHistoryService>;
    const mockExec = jest.spyOn(child_process, 'exec');

    beforeEach(() => {
        jest.clearAllMocks();
        mockLogger = new WinstonLogger('HealthService') as jest.Mocked<WinstonLogger>;
        mockMetricsHistory = {
            saveMetrics: jest.fn().mockResolvedValue(undefined)
        } as unknown as jest.Mocked<MetricsHistoryService>;
        healthMonitor = new HealthMonitorService(mockMetricsHistory, mockLogger);
    });

    describe('getDiskUsage', () => {
        it('should get disk usage for Unix systems', async () => {
            (os.platform as jest.Mock).mockReturnValue('linux');

            mockExec.mockImplementation((command: string, callback: any) => {
                callback(null, '45%\n', '');
                return {} as child_process.ChildProcess;
            });

            const diskUsage = await healthMonitor['getDiskUsageUnix']('/');
            expect(diskUsage).toBe(45);
        });

        it('should get disk usage for Windows systems', async () => {
            (os.platform as jest.Mock).mockReturnValue('win32');

            mockExec.mockImplementation((command: string, callback: any) => {
                callback(null, 'FreeSpace  Size\n 5000     10000', '');
                return {} as child_process.ChildProcess;
            });

            const diskUsage = await healthMonitor['getDiskUsageWin']('C:');
            expect(diskUsage).toBe(50);
        });

        it('should handle disk usage errors', async () => {
            (os.platform as jest.Mock).mockReturnValue('linux');

            mockExec.mockImplementation((command: string, callback: any) => {
                callback(new Error('Command failed'), '', '');
                return {} as child_process.ChildProcess;
            });

            await expect(healthMonitor['getDiskUsageUnix']('/')).rejects.toThrow();
        });
    });

    describe('checkSystem', () => {
        beforeEach(() => {
            (os.loadavg as jest.Mock).mockReturnValue([1.5, 1.0, 0.5]);
            (os.networkInterfaces as jest.Mock).mockReturnValue({
                eth0: [{ address: '127.0.0.1' }]
            });

            jest.spyOn(process, 'memoryUsage').mockReturnValue({
                heapUsed: 100,
                heapTotal: 200,
                external: 0,
                arrayBuffers: 0,
                rss: 300
            });

            mockExec.mockImplementation((command: string, callback: any) => {
                callback(null, '20%\n', '');
                return {} as child_process.ChildProcess;
            });
        });

        it('should return system metrics', async () => {
            jest.spyOn(healthMonitor, 'getNetworkStats').mockResolvedValue({
                uploadSpeed: 10,
                downloadSpeed: 10,
                activeConnections: 1,
                latency: 10
            });

            const metrics = await healthMonitor.checkSystem();

            expect(metrics).toEqual({
                cpuUsage: 1.5,
                memoryUsage: 100,
                diskUsage: 20,
                networkStats: {
                    uploadSpeed: 10,
                    downloadSpeed: 10,
                    activeConnections: 1,
                    latency: 10
                }
            });

            expect(mockMetricsHistory.saveMetrics).toHaveBeenCalledWith(expect.objectContaining({
                systemMetrics: metrics
            }));
        });
    });

    describe('monitorDependencies', () => {
        it('should return healthy status when MongoDB is connected', async () => {
            const mockClient = {
                db: jest.fn().mockReturnValue({
                    command: jest.fn().mockResolvedValue({ ok: 1 })
                })
            };

            (mongoConnection.getClient as jest.Mock).mockReturnValue(mockClient);

            const result = await healthMonitor.monitorDependencies();
            expect(result.mongodb).toEqual({
                status: 'healthy',
                latencyMs: expect.any(Number),
                lastChecked: expect.any(String)
            });
        });

        it('should return unhealthy status when MongoDB check fails', async () => {
            (mongoConnection.getClient as jest.Mock).mockImplementation(() => {
                throw new Error('Connection failed');
            });

            const result = await healthMonitor.monitorDependencies();
            expect(result.mongodb).toEqual({
                status: 'unhealthy',
                latencyMs: 0,
                lastChecked: expect.any(String)
            });

            expect(mockLogger.error).toHaveBeenCalledWith('MongoDB health check failed', expect.any(Object));
        });
    });

    describe('getNetworkStats', () => {
        beforeEach(() => {
            (os.platform as jest.Mock).mockReturnValue('linux');
            (os.networkInterfaces as jest.Mock).mockReturnValue({
                eth0: [{ family: 'IPv4' }]
            });
        });

        it('should return network stats', async () => {
            jest.spyOn(healthMonitor as any, 'getLinuxNetworkStats').mockResolvedValue({
                bytesReceived: 1000,
                bytesSent: 2000,
                timestamp: Date.now()
            });

            jest.spyOn(healthMonitor as any, 'measureLatency').mockResolvedValue(50);
            jest.spyOn(healthMonitor as any, 'getActiveConnections').mockResolvedValue(5);

            const stats = await healthMonitor.getNetworkStats();

            expect(stats).toEqual({
                uploadSpeed: expect.any(Number),
                downloadSpeed: expect.any(Number),
                activeConnections: 5,
                latency: 50
            });
        });

        it('should return zero network stats on failure', async () => {
            jest.spyOn(healthMonitor as any, 'getLinuxNetworkStats').mockRejectedValue(new Error('Network error'));
            jest.spyOn(healthMonitor as any, 'measureLatency').mockResolvedValue(0);
            jest.spyOn(healthMonitor as any, 'getActiveConnections').mockResolvedValue(0);

            const stats = await healthMonitor.getNetworkStats();

            expect(stats).toEqual({
                uploadSpeed: 0,
                downloadSpeed: 0,
                activeConnections: 0,
                latency: 0
            });
        });
    });
});
