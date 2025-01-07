import pytest
from app import create_app, mongo
from bson import ObjectId
from datetime import datetime

@pytest.fixture
def app():
    app = create_app()
    app.config['TESTING'] = True
    app.config['MONGO_URI'] = 'mongodb://localhost:27017/test_db'
    
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
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "isDeleted": False
        }
        mongo.db.users.insert_one(user_dict)
        return user_dict