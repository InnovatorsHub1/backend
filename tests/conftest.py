import pytest
from datetime import datetime, timezone
from bson import ObjectId
from typing import Dict, List, Any, Optional
from app.services.mongodb_service import MongoDBService
from app.services.redis_cache_service import RedisCacheService
from app.services.user_service import UserService
from app import create_app
import json

class MockRedisClient:
    """Mock Redis client for testing"""
    
    def __init__(self):
        self.data = {}
        self._is_connected = True

    def ping(self):
        """Test connection"""
        return True

    def get(self, key: str) -> Optional[str]:
        """Get value from mock cache"""
        value = self.data.get(key)
        if value is None:
            return None
        return value

    def setex(self, key: str, time: int, value: str) -> bool:
        """Set value with expiration in mock cache"""
        self.data[key] = value
        return True

    def delete(self, *keys: str) -> int:
        """Delete keys from mock cache"""
        count = 0
        for key in keys:
            if key in self.data:
                del self.data[key]
                count += 1
        return count

    def scan(self, cursor: int = 0, match: str = None, count: int = None):
        """Scan keys in mock cache"""
        if match:
            # Convert Redis pattern to regex pattern
            pattern = match.replace("*", ".*")
            import re
            regex = re.compile(pattern)
            matched_keys = [k for k in self.data.keys() if regex.match(k)]
            return (0, matched_keys)
        return (0, list(self.data.keys()))

    def exists(self, key: str) -> bool:
        """Check if key exists in mock cache"""
        return key in self.data

    def flushdb(self) -> bool:
        """Clear all data in mock cache"""
        self.data.clear()
        return True

class MockRedis:
    """Mock Redis factory"""
    
    @staticmethod
    def from_url(*args, **kwargs) -> MockRedisClient:
        return MockRedisClient()

class MockDBService:
    """Mock database service for testing"""
    
    def __init__(self):
        self.data = {}

    def find_one(self, query: Dict, projection: Dict = None) -> Optional[Dict]:
        """Find one document in mock DB"""
        # Handle ObjectId conversion
        if '_id' in query and isinstance(query['_id'], ObjectId):
            query['_id'] = str(query['_id'])

        # Handle simple exact matches
        for doc in self.data.values():
            matches = all(
                key in doc and doc[key] == value
                for key, value in query.items()
            )
            if matches:
                return doc.copy()
        return None

    def find(self, query: Dict, projection: Dict = None, sort: List = None) -> List[Dict]:
        """Find documents in mock DB"""
        # Filter documents based on query
        results = []
        for doc in self.data.values():
            matches = all(
                key in doc and doc[key] == value
                for key, value in query.items()
            )
            if matches:
                results.append(doc.copy())

        # Apply sorting if specified
        if sort:
            for field, direction in reversed(sort):
                results.sort(
                    key=lambda x: x.get(field),
                    reverse=(direction == -1)
                )

        return results

    def insert_one(self, document: Dict) -> str:
        """Insert one document in mock DB"""
        _id = str(ObjectId())
        document['_id'] = _id
        document.setdefault('created_at', datetime.now(timezone.utc))
        document.setdefault('updated_at', datetime.now(timezone.utc))
        self.data[_id] = document.copy()
        return _id

    def update_one(self, filter: Dict, update: Dict, upsert: bool = False) -> Any:
        """Update one document in mock DB"""
        # Convert ObjectId
        if '_id' in filter and isinstance(filter['_id'], ObjectId):
            filter['_id'] = str(filter['_id'])

        # Find matching document
        doc_id = None
        for _id, doc in self.data.items():
            matches = all(
                key in doc and doc[key] == value
                for key, value in filter.items()
            )
            if matches:
                doc_id = _id
                break

        if doc_id:
            # Update document
            if '$set' in update:
                self.data[doc_id].update(update['$set'])
            self.data[doc_id]['updated_at'] = datetime.now(timezone.utc)
            return type('UpdateResult', (), {'modified_count': 1})()
        elif upsert:
            # Insert new document
            new_id = self.insert_one({**filter, **update.get('$set', {})})
            return type('UpdateResult', (), {
                'modified_count': 0,
                'upserted_id': new_id
            })()
        return type('UpdateResult', (), {'modified_count': 0})()

    def count_documents(self, filter: Dict) -> int:
        """Count documents in mock DB"""
        return len(self.find(filter))

@pytest.fixture
def mock_redis(monkeypatch):
    """Create mock Redis instance"""
    mock_redis = MockRedis()
    monkeypatch.setattr("redis.Redis.from_url", mock_redis.from_url)
    return mock_redis.from_url()

@pytest.fixture
def mock_db():
    """Create mock DB instance"""
    return MockDBService()

@pytest.fixture
def app(mock_redis, mock_db):
    """Create test Flask application with mocked services"""
    app = create_app()
    app.config.update({
        'TESTING': True,
        'DEBUG': False,
        'MONGO_URI': 'mongodb://localhost:27017/test_db',
        'REDIS_URL': 'redis://localhost:6379/1',
        'PROPAGATE_EXCEPTIONS': True
    })

    # Initialize services with mocks
    cache_service = RedisCacheService(app.config['REDIS_URL'])
    
    # Replace services
    app.user_service = UserService(mock_db, cache_service)

    return app

@pytest.fixture
def client(app):
    """Create test client"""
    return app.test_client()

@pytest.fixture
def mock_user_data():
    """Create sample user data"""
    return {
        "username": "testuser",
        "email": "test@example.com"
    }

@pytest.fixture
def mock_user_in_db(app):
    """Create a test user in the mock database"""
    return app.user_service.create_user({
        "username": "testuser",
        "email": "test@example.com"
    })

@pytest.fixture
def headers():
    """Default headers for requests"""
    return {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }

@pytest.fixture(autouse=True)
def setup_and_teardown(app):
    """Setup and teardown for each test"""
    # Setup
    yield
    # Teardown
    if hasattr(app, 'user_service'):
        app.user_service.db = MockDBService()  # Reset DB
        if hasattr(app.user_service.cache, '_redis_client'):
            app.user_service.cache._redis_client.flushdb()  # Clear cache