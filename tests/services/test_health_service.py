import pytest
import json
from datetime import datetime
from pymongo.errors import ServerSelectionTimeoutError
from redis.exceptions import ConnectionError as RedisConnectionError

from tests.mocks.mock_db_service import MockDBService
from tests.mocks.mock_redis import MockRedisClient


class MockHealthDBService(MockDBService):
    def __init__(self):
        super().__init__()
        self._collection = self
        self.database = self

    def command(self, command_name, *args, **kwargs):
        if command_name == 'ping':
            return {'ok': 1.0}
        return None

class MockHealthRedisClient(MockRedisClient):
    def __init__(self):
        super().__init__()
        self._redis_client = self

class TestHealthRoutes:
    """Test suite for health endpoints"""

    @pytest.fixture
    def mock_healthy_db(self):
        return MockHealthDBService()

    @pytest.fixture
    def mock_healthy_redis(self):
        return MockHealthRedisClient()

    @pytest.fixture
    def health_app(self, app, mock_healthy_db, mock_healthy_redis):
        from app.services.health_service import HealthService
        app.health_service = HealthService(app, mock_healthy_db, mock_healthy_redis)
        app.health_service.start_time = datetime.utcnow()
        return app

    def test_get_health_success(self, health_app, client, headers):
        """Test basic health check when all systems are healthy"""
        response = client.get('/health/', headers=headers)
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data["status"] == "healthy"
        assert all(key in data for key in ["timestamp", "dependencies", "system", "application"])
        assert all(dep["status"] == "healthy" for dep in data["dependencies"].values())

    def test_get_health_mongo_failure(self, health_app, client, headers):
        """Test health check when MongoDB is unhealthy"""
        def mock_command(*args, **kwargs):
            raise ServerSelectionTimeoutError("MongoDB connection failed")
        
        health_app.health_service.mongo_service.command = mock_command

        response = client.get('/health/', headers=headers)
        assert response.status_code == 503
        
        data = json.loads(response.data)
        assert data["status"] == "unhealthy"
        assert data["dependencies"]["mongodb"]["status"] == "unhealthy"
        assert "MongoDB connection failed" in data["dependencies"]["mongodb"]["error"]

    def test_get_health_redis_failure(self, health_app, client, headers):
        """Test health check when Redis is unhealthy"""
        def mock_ping(*args, **kwargs):
            raise RedisConnectionError("Redis connection failed")
        
        health_app.health_service.redis_service.ping = mock_ping

        response = client.get('/health/', headers=headers)
        assert response.status_code == 503
        
        data = json.loads(response.data)
        assert data["status"] == "unhealthy"
        assert data["dependencies"]["redis"]["status"] == "unhealthy"
        assert "Redis connection failed" in data["dependencies"]["redis"]["error"]

    def test_get_detailed_health_success(self, health_app, client, headers):
        """Test detailed health check when all systems are healthy"""
        response = client.get('/health/detailed', headers=headers)
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert all(key in data for key in ["health", "system_metrics", "application_metrics"])
        assert data["health"]["status"] == "healthy"
        assert all(dep["status"] == "healthy" for dep in data["health"]["dependencies"].values())

        # Verify metrics structure
        system_metrics = data["system_metrics"]
        assert all(key in system_metrics for key in ["cpu", "memory", "disk"])
        assert all(key in system_metrics["memory"] for key in ["total_gb", "used_gb", "usage_percent"])
        assert all(key in system_metrics["disk"] for key in ["total_gb", "used_gb", "usage_percent"])

        app_metrics = data["application_metrics"]
        assert all(key in app_metrics for key in [
            "uptime_seconds", 
            "user_count", 
            "deleted_user_count", 
            "python_process"
        ])
        assert all(key in app_metrics["python_process"] for key in [
            "memory_usage_mb",
            "cpu_usage_percent"
        ])

    def test_get_detailed_health_partial_failure(self, health_app, client, headers):
        """Test detailed health check with Redis failure"""
        def mock_ping(*args, **kwargs):
            raise RedisConnectionError("Redis connection failed")
        
        health_app.health_service.redis_service.ping = mock_ping

        response = client.get('/health/detailed', headers=headers)
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data["health"]["status"] == "unhealthy"
        assert data["health"]["dependencies"]["redis"]["status"] == "unhealthy"
        assert data["health"]["dependencies"]["mongodb"]["status"] == "healthy"
        assert "system_metrics" in data
        assert "application_metrics" in data

    def test_get_metrics_success(self, health_app, client, headers):
        """Test metrics endpoint"""
        response = client.get('/health/metrics', headers=headers)
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert all(key in data for key in [
            "uptime_seconds", 
            "user_count", 
            "deleted_user_count", 
            "python_process"
        ])
        assert isinstance(data["uptime_seconds"], (int, float))
        assert isinstance(data["user_count"], int)
        assert isinstance(data["deleted_user_count"], int)
        assert isinstance(data["python_process"]["memory_usage_mb"], (int, float))
        assert isinstance(data["python_process"]["cpu_usage_percent"], (int, float))

    def test_get_metrics_failure(self, health_app, client, headers):
        """Test metrics endpoint when collection fails"""
        def mock_metrics(*args):
            raise Exception("Failed to collect metrics")
        
        health_app.health_service.get_application_metrics = mock_metrics

        response = client.get('/health/metrics', headers=headers)
        assert response.status_code == 500
        
        data = json.loads(response.data)
        assert "message" in data
        assert data["message"] == "Metrics collection failed"
        assert data["status"] == 500

    @pytest.mark.parametrize("endpoint", [
        "/health/",
        "/health/detailed",
        "/health/metrics"
    ])
    def test_health_endpoints_headers(self, health_app, client, headers, endpoint):
        """Test health endpoints return correct headers"""
        response = client.get(endpoint, headers=headers)
        assert response.headers['Content-Type'] == 'application/json'
        
        # Should not raise error
        json.loads(response.data)