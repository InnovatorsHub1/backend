import pytest
from app.services.user_service import UserService
from app.errors.exceptions import APIError
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
        # Should not raise any exception
        UserService.validate_user_data(data)

    def test_validate_user_data_missing_fields(self):
        """Test user data validation with missing fields"""
        with pytest.raises(APIError) as exc_info:
            UserService.validate_user_data({"username": "testuser"})
        assert "Missing required fields" in str(exc_info.value)
        assert exc_info.value.status_code == 400

class TestCreateUser:
    def test_create_user_success(self, app, mock_user_data):
        """Test successful user creation"""
        with app.app_context():
            user = UserService.create_user(mock_user_data)
            assert user.username == mock_user_data['username']
            assert user.email == mock_user_data['email']
            assert not user.isDeleted

    def test_create_user_duplicate_email(self, app, mock_user_in_db, mock_user_data):
        """Test user creation with duplicate email"""
        with app.app_context():
            with pytest.raises(APIError) as exc_info:
                UserService.create_user(mock_user_data)
            assert "Email already exists" in str(exc_info.value)
            assert exc_info.value.status_code == 400

class TestGetUsers:
    def test_get_all_users_empty(self, app):
        """Test getting all users from empty DB"""
        with app.app_context():
            users = UserService.get_all_users()
            assert isinstance(users, list)
            assert len(users) == 0

    def test_get_all_users_with_data(self, app, mock_user_in_db):
        """Test getting all users with data in DB"""
        with app.app_context():
            users = UserService.get_all_users()
            assert len(users) == 1
            assert users[0].email == mock_user_in_db['email']

class TestGetUser:
    def test_get_user_by_id_success(self, app, mock_user_in_db):
        """Test getting a specific user by ID"""
        with app.app_context():
            user = UserService.get_user_by_id(str(mock_user_in_db['_id']))
            assert user.email == mock_user_in_db['email']

    def test_get_user_not_found(self, app):
        """Test getting a non-existent user"""
        with app.app_context():
            with pytest.raises(APIError) as exc_info:
                UserService.get_user_by_id(str(ObjectId()))
            assert "User not found" in str(exc_info.value)
            assert exc_info.value.status_code == 404

class TestUpdateUser:
    def test_update_user_success(self, app, mock_user_in_db):
        """Test successful user update"""
        with app.app_context():
            update_data = {
                "username": "updated_user",
                "email": "updated@example.com"
            }
            user = UserService.update_user(str(mock_user_in_db['_id']), update_data)
            assert user.username == update_data['username']
            assert user.email == update_data['email']

    def test_update_user_not_found(self, app):
        """Test updating non-existent user"""
        with app.app_context():
            with pytest.raises(APIError) as exc_info:
                UserService.update_user(str(ObjectId()), {"username": "test"})
            assert "User not found" in str(exc_info.value)
            assert exc_info.value.status_code == 404

class TestDeleteUser:
    def test_delete_user_success(self, app, mock_user_in_db):
        """Test successful user deletion"""
        with app.app_context():
            user_id = str(mock_user_in_db['_id'])
            UserService.delete_user(user_id)
            # Verify deletion
            with pytest.raises(APIError) as exc_info:
                UserService.get_user_by_id(user_id)
            assert "User not found" in str(exc_info.value)

    def test_delete_already_deleted_user(self, app, mock_user_in_db):
        """Test deleting an already deleted user"""
        with app.app_context():
            user_id = str(mock_user_in_db['_id'])
            UserService.delete_user(user_id)
            with pytest.raises(APIError) as exc_info:
                UserService.delete_user(user_id)
            assert "already deleted" in str(exc_info.value)
            assert exc_info.value.status_code == 400

class TestRestoreUser:
    def test_restore_user_success(self, app, mock_user_in_db):
        """Test successful user restoration"""
        with app.app_context():
            user_id = str(mock_user_in_db['_id'])
            UserService.delete_user(user_id)
            restored_user = UserService.restore_user(user_id)
            assert not restored_user.isDeleted

    def test_restore_active_user(self, app, mock_user_in_db):
        """Test restoring an active user"""
        with app.app_context():
            with pytest.raises(APIError) as exc_info:
                UserService.restore_user(str(mock_user_in_db['_id']))
            assert "not deleted" in str(exc_info.value)
            assert exc_info.value.status_code == 400

