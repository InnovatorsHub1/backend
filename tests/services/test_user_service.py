# tests/services/test_user_service.py
import pytest
from app.services.user_service import UserService
from bson import ObjectId

class TestUserValidation:
    def test_validate_email_success(self):
        """Test valid email validation"""
        assert UserService.validate_email("test@example.com") is True
        assert UserService.validate_email("user.name+tag@domain.co.uk") is True

    def test_validate_email_failure(self):
        """Test invalid email validation"""
        assert UserService.validate_email("invalid-email") is False
        assert UserService.validate_email("@domain.com") is False
        assert UserService.validate_email("user@.com") is False

    def test_validate_user_data_success(self):
        """Test valid user data validation"""
        data = {
            "username": "testuser",
            "email": "test@example.com"
        }
        assert UserService.validate_user_data(data) is None

    def test_validate_user_data_missing_fields(self):
        """Test user data validation with missing fields"""
        data = {"username": "testuser"}
        error = UserService.validate_user_data(data)
        assert error is not None
        assert "Missing required fields" in error

    def test_validate_user_data_invalid_username(self):
        """Test user data validation with invalid username"""
        data = {
            "username": "ab",  # Too short
            "email": "test@example.com"
        }
        error = UserService.validate_user_data(data)
        assert error is not None
        assert "Username must be" in error

class TestCreateUser:
    def test_create_user_success(self, app, mock_user_data):
        """Test successful user creation"""
        with app.app_context():
            user, error = UserService.create_user(mock_user_data)
            assert error is None
            assert user is not None
            assert user.username == mock_user_data['username']
            assert user.email == mock_user_data['email']
            assert not user.isDeleted

    def test_create_user_duplicate_email(self, app, mock_user_in_db, mock_user_data):
        """Test user creation with duplicate email"""
        with app.app_context():
            user, error = UserService.create_user(mock_user_data)
            assert error is not None
            assert "Email already exists" in error
            assert user is None

    def test_create_user_invalid_data(self, app):
        """Test user creation with invalid data"""
        with app.app_context():
            user, error = UserService.create_user({"username": "test"})
            assert error is not None
            assert user is None

class TestGetUsers:
    def test_get_all_users_empty(self, app):
        """Test getting all users from empty DB"""
        with app.app_context():
            users, error = UserService.get_all_users()
            assert error is None
            assert len(users) == 0

    def test_get_all_users_with_data(self, app, mock_user_in_db):
        """Test getting all users with data in DB"""
        with app.app_context():
            users, error = UserService.get_all_users()
            assert error is None
            assert len(users) > 0
            assert users[0].email == mock_user_in_db['email']

    def test_get_all_users_including_deleted(self, app, mock_user_in_db):
        """Test getting all users including deleted ones"""
        with app.app_context():
            # First delete the user
            UserService.delete_user(str(mock_user_in_db['_id']))
            
            # Then get all users including deleted
            users, error = UserService.get_all_users(include_deleted=True)
            assert error is None
            assert len(users) > 0
            assert any(user.isDeleted for user in users)

class TestGetUser:
    def test_get_user_by_id_success(self, app, mock_user_in_db):
        """Test getting a specific user by ID"""
        with app.app_context():
            user, error = UserService.get_user_by_id(str(mock_user_in_db['_id']))
            assert error is None
            assert user is not None
            assert user.email == mock_user_in_db['email']

    def test_get_user_not_found(self, app):
        """Test getting a non-existent user"""
        with app.app_context():
            user, error = UserService.get_user_by_id(str(ObjectId()))
            assert error is not None
            assert "User not found" in error
            assert user is None

    def test_get_user_invalid_id(self, app):
        """Test getting a user with invalid ID format"""
        with app.app_context():
            user, error = UserService.get_user_by_id("invalid-id")
            assert error is not None
            assert "Invalid user ID format" in error
            assert user is None

class TestUpdateUser:
    def test_update_user_success(self, app, mock_user_in_db):
        """Test successful user update"""
        with app.app_context():
            update_data = {
                "username": "updated_user",
                "email": "updated@example.com"
            }
            user, error = UserService.update_user(
                str(mock_user_in_db['_id']),
                update_data
            )
            assert error is None
            assert user is not None
            assert user.username == update_data['username']
            assert user.email == update_data['email']

    def test_update_user_not_found(self, app):
        """Test updating non-existent user"""
        with app.app_context():
            user, error = UserService.update_user(
                str(ObjectId()),
                {"username": "test"}
            )
            assert error is not None
            assert "User not found" in error
            assert user is None

    def test_update_user_invalid_data(self, app, mock_user_in_db):
        """Test user update with invalid data"""
        with app.app_context():
            user, error = UserService.update_user(
                str(mock_user_in_db['_id']),
                {"email": "invalid-email"}
            )
            assert error is not None
            assert "Invalid email format" in error
            assert user is None

