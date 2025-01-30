import { HealthMonitor } from '@gateway/services/healthMonitor.service';
import { WinstonLogger } from '@gateway/core/logger/winston.logger';
import { mongoConnection } from '@gateway/utils/mongoConnection';
import { HEALTH_CONFIG } from '@gateway/config/health_config';
import os from 'os';
import * as child_process from 'child_process';

jest.mock('../core/logger/winston.logger');
jest.mock('@gateway/utils/mongoConnection');
jest.mock('os');
jest.mock('child_process');

describe('HealthMonitor', () => {
    let healthMonitor: HealthMonitor;
    let mockLogger: jest.Mocked<WinstonLogger>;
    const mockExec = jest.mocked(child_process.exec);
    
    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();
        
        // Initialize the health monitor
        healthMonitor = new HealthMonitor();
        mockLogger = new WinstonLogger('HealthService') as jest.Mocked<WinstonLogger>;
    });

    describe('getDiskUsage', () => {
        it('should get disk usage for Unix systems', async () => {
            (os.platform as jest.Mock).mockReturnValue('linux');
            mockExec.mockImplementation((command: string, options: any, callback?: any) => {
                // Handle both 2-arg and 3-arg cases
                const actualCallback = callback || options;
                actualCallback(null, '45%\n', '');
                return {} as child_process.ChildProcess;
            });

            const metrics = await healthMonitor.checkSystem();
            expect(metrics.diskUsage).toBe(45);
        });

        it('should get disk usage for Windows systems', async () => {
            (os.platform as jest.Mock).mockReturnValue('win32');
            mockExec.mockImplementation((command: string, options: any, callback?: any) => {
                // Handle both 2-arg and 3-arg cases
                const actualCallback = callback || options;
                actualCallback(null, 'FreeSpace  Size\n 5000     10000', '');
                return {} as child_process.ChildProcess;
            });

            const metrics = await healthMonitor.checkSystem();
            expect(metrics.diskUsage).toBe(50); // (10000-5000)/10000 * 100
        });

        it('should handle disk usage errors', async () => {
            (os.platform as jest.Mock).mockReturnValue('linux');
            mockExec.mockImplementation((command: string, options: any, callback?: any) => {
                // Handle both 2-arg and 3-arg cases
                const actualCallback = callback || options;
                actualCallback(new Error('Command failed'), '', '');
                return {} as child_process.ChildProcess;
            });

            await expect(healthMonitor.checkSystem()).rejects.toThrow();
        });
    });

    describe('checkSystem', () => {
        beforeEach(() => {
            // Mock OS methods
            (os.loadavg as jest.Mock).mockReturnValue([1.5, 1.0, 0.5]);
            (os.networkInterfaces as jest.Mock).mockReturnValue({
                eth0: [{ address: '127.0.0.1' }]
            });
            
            // Mock process.memoryUsage
            const mockMemoryUsage = jest.spyOn(process, 'memoryUsage');
            mockMemoryUsage.mockReturnValue({
                heapUsed: 100,
                heapTotal: 200,
                external: 0,
                arrayBuffers: 0,
                rss: 300
            });

            // Mock disk usage
            mockExec.mockImplementation((command: string, options: any, callback?: any) => {
                // Handle both 2-arg and 3-arg cases
                const actualCallback = callback || options;
                actualCallback(null, '20%\n', '');
                return {} as child_process.ChildProcess;
            });
        });

        it('should return system metrics', async () => {
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
            
            const result = await healthMonitor.monitorDependecies();

            expect(result.mongodb).toEqual({
                status: 'healthy',
                latencyMs: expect.any(Number),
                lastChecked: expect.any(String)
            });
        });
    });
});