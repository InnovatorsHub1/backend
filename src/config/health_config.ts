const HEALTH_CONFIG = {
    checkInterval: 60, // seconds
    alertThresholds: {
      cpu: 80,
      memory: 85,
      disk: 90,
      responseTime: 2000
    },
    dependencies: {
      database: {
        timeout: 5000,
        required: true
      },
      redis: {
        timeout: 3000,
        required: true
      }
    }
  } as const;