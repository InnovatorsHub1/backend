import pytest
from app import create_app, mongo
from bson import ObjectId
from datetime import datetime, timezone
from flask import request

@pytest.fixture
def app():
    app = create_app()
    app.config.update({
        'TESTING': True,
        'MONGO_URI': 'mongodb://localhost:27017/test_db',
        'DEBUG': False,
        'JSON_SORT_KEYS': False,
        'PROPAGATE_EXCEPTIONS': True
    })
    
    yield app
    
    # Clean up the test database
    with app.app_context():
        mongo.db.users.delete_many({})

@pytest.fixture
def client(app):
    return app.test_client()

@pytest.fixture
def mock_user_data():
    return {
        "username": "testuser",
        "email": "test@example.com"
    }

@pytest.fixture
def mock_user_in_db(app, mock_user_data):
    with app.app_context():
        user_dict = {
            **mock_user_data,
            "_id": ObjectId(),
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "isDeleted": False
        }
        mongo.db.users.insert_one(user_dict)
        return user_dict

@pytest.fixture(autouse=True)
def setup_test_db(app):
    """Setup/teardown for test database"""
    with app.app_context():
        mongo.db.users.delete_many({})
    yield
    with app.app_context():
        mongo.db.users.delete_many({})

@pytest.fixture
def headers():
    """Default headers for requests"""
    return {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }

@pytest.fixture(autouse=True)
def mock_env_vars(monkeypatch):
    """Mock environment variables for testing"""
    monkeypatch.setenv('MONGO_USERNAME', 'test_user')
    monkeypatch.setenv('MONGO_PASSWORD', 'test_password')
    monkeypatch.setenv('MONGO_DB', 'test_db')
    monkeypatch.setenv('FLASK_ENV', 'testing')