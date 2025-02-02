import { Request, Response } from "express";
import { inject, injectable } from "inversify";
import { HealthMonitorService } from "@gateway/services/healthMonitor.service";
import { TYPES } from "../core/di/types";
import { WinstonLogger } from "@gateway/core/logger/winston.logger";

@injectable()
export class HealthMonitorController {
    private logger = new WinstonLogger("HealthMonitorController");

    constructor(
        @inject(TYPES.HealthMonitorService) private readonly healthMonitorService: HealthMonitorService
    ) {}

    public getHealthStatus = async (req: Request, res: Response): Promise<void> => {
        try {
            this.logger.info("Health check requested");
            
            const systemMetrics = await this.healthMonitorService.checkSystem();
            const dependencies = await this.healthMonitorService.monitorDependencies();

            const isSystemHealthy =
                systemMetrics.cpuUsage < 90 &&
                systemMetrics.diskUsage < 90 &&
                systemMetrics.networkStats.latency < 1000;

            const isDependenciesHealthy = Object.values(dependencies).every(dep => dep.status === "healthy");

            const status = {
                status: isSystemHealthy && isDependenciesHealthy ? "healthy" : "unhealthy",
                timestamp: new Date().toISOString(),
                system: {
                    ...systemMetrics,
                    status: isSystemHealthy ? "healthy" : "degraded"
                },
                dependencies: {
                    ...dependencies,
                    status: isDependenciesHealthy ? "healthy" : "degraded"
                }
            };

            res.status(status.status === "healthy" ? 200 : 503).json(status);
        } catch (error) {
            this.logger.error("Health check failed", { error });
            res.status(500).json({
                status: "error",
                message: "Failed to retrieve health status",
                timestamp: new Date().toISOString()
            });
        }
    };
}
