import pytest

from io import BytesIO

from app.services.redis_cache_service import RedisCacheService
from app.services.user_service import UserService
from app.services.file_service import FileService
from app.services.pdf_service import PDFService
from app import create_app

from tests.mocks.mock_pdf import MockPDFService
from tests.mocks.mock_db_service import MockDBService
from tests.mocks.mock_queue import MockQueueService
from tests.mocks.mock_redis import MockRedis


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
def mock_queue():
    """Create mock Queue instance"""
    return MockQueueService()

@pytest.fixture
def mock_pdf():
    """Create mock PDF service instance"""
    return MockPDFService()

@pytest.fixture
def mock_file_service():
    """Create a mock FileService instance"""
    return FileService(MockDBService())

@pytest.fixture
def app(mock_redis, mock_db, mock_queue, mock_pdf, mock_file_service):
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
    app.queue_service = mock_queue  
    app.pdf_service = mock_pdf
    app.file_service = mock_file_service

    return app

@pytest.fixture
def client(app):
    """Create test client"""
    return app.test_client()

@pytest.fixture
def mock_csv_file():
    """Provide a mock CSV file for testing uploads"""
    file_content = b"name,email,age\nJohn Doe,john@example.com,30\nJane Smith,jane@example.com,25"
    return BytesIO(file_content), "sample.csv"

@pytest.fixture
def headers_multipart():
    """Headers for file upload requests"""
    return {
        'Content-Type': 'multipart/form-data',
    }

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
    if hasattr(app, 'queue_service'):
        app.queue_service = MockQueueService()