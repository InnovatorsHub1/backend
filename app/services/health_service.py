from typing import Dict, Any
import psutil
import logging
from datetime import datetime
from pymongo.errors import ServerSelectionTimeoutError
from redis.exceptions import ConnectionError as RedisConnectionError

logger = logging.getLogger(__name__)

class HealthService:
    """Service for monitoring system and application health"""

    def __init__(self, app, mongo_service, redis_service):
        self.app = app
        self.mongo_service = mongo_service
        self.redis_service = redis_service
        self.start_time = datetime.utcnow()

    def check_mongo_connection(self) -> Dict[str, Any]:
        """Check MongoDB connection status"""
        try:
            # Ping MongoDB
            self.mongo_service._collection.database.command('ping')
            return {
                "status": "healthy",
                "latency_ms": 0  # You could implement actual latency measurement
            }
        except ServerSelectionTimeoutError as e:
            logger.error(f"MongoDB connection error: {str(e)}")
            return {
                "status": "unhealthy",
                "error": str(e)
            }
        except Exception as e:
            logger.error(f"MongoDB unexpected error: {str(e)}")
            return {
                "status": "unhealthy",
                "error": str(e)
            }

    def check_redis_connection(self) -> Dict[str, Any]:
        """Check Redis connection status"""
        try:
            # Ping Redis
            self.redis_service._redis_client.ping()
            return {
                "status": "healthy",
                "latency_ms": 0  # You could implement actual latency measurement
            }
        except RedisConnectionError as e:
            logger.error(f"Redis connection error: {str(e)}")
            return {
                "status": "unhealthy",
                "error": str(e)
            }
        except Exception as e:
            logger.error(f"Redis unexpected error: {str(e)}")
            return {
                "status": "unhealthy",
                "error": str(e)
            }

    def get_system_metrics(self) -> Dict[str, Any]:
        """Get system resource metrics"""
        try:
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')

            return {
                "cpu": {
                    "usage_percent": cpu_percent
                },
                "memory": {
                    "total_gb": memory.total / (1024 ** 3),
                    "used_gb": memory.used / (1024 ** 3),
                    "usage_percent": memory.percent
                },
                "disk": {
                    "total_gb": disk.total / (1024 ** 3),
                    "used_gb": disk.used / (1024 ** 3),
                    "usage_percent": disk.percent
                }
            }
        except Exception as e:
            logger.error(f"Error getting system metrics: {str(e)}")
            return {"error": str(e)}

    def get_application_metrics(self) -> Dict[str, Any]:
        """Get application-specific metrics"""
        try:
            return {
                "uptime_seconds": (datetime.utcnow() - self.start_time).total_seconds(),
                "user_count": self.mongo_service.count_documents({"isDeleted": False}),
                "deleted_user_count": self.mongo_service.count_documents({"isDeleted": True}),
                "python_process": {
                    "memory_usage_mb": psutil.Process().memory_info().rss / (1024 * 1024),
                    "cpu_usage_percent": psutil.Process().cpu_percent()
                }
            }
        except Exception as e:
            logger.error(f"Error getting application metrics: {str(e)}")
            return {"error": str(e)}

    def get_health_status(self) -> Dict[str, Any]:
        """Get comprehensive health status"""
        mongo_status = self.check_mongo_connection()
        redis_status = self.check_redis_connection()
        
        # Determine overall status
        overall_status = "healthy"
        if mongo_status.get("status") == "unhealthy" or redis_status.get("status") == "unhealthy":
            overall_status = "unhealthy"

        return {
            "status": overall_status,
            "timestamp": datetime.utcnow().isoformat(),
            "dependencies": {
                "mongodb": mongo_status,
                "redis": redis_status
            },
            "system": self.get_system_metrics(),
            "application": self.get_application_metrics()
        }