import pytest
from app.errors.exceptions import APIError
from app.models.user import User
from bson import ObjectId
from datetime import datetime, timezone
from app.utils.general_utils import validate_email

class TestCaching:
    """Tests for caching behavior"""

    def test_get_user_uses_cache(self, app, mock_user_in_db):
        """Test that get_user uses cache"""
        user_id = mock_user_in_db._id

        # First call should store in cache
        user1 = app.user_service.get_user_by_id(user_id)
        
        # Modify in DB directly (without touching cache)
        app.user_service.db.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': {'username': 'modified_name'}}
        )
        
        # Second call should use cache
        user2 = app.user_service.get_user_by_id(user_id)
        assert user2.username == user1.username
        assert user2.username != 'modified_name'

    def test_get_all_users_uses_cache(self, app, mock_user_in_db):
        """Test that get_all_users uses cache"""
        # First call to cache
        users1 = app.user_service.get_all_users()
        initial_count = len(users1)

        # Add user directly to DB
        app.user_service.db.insert_one({
            "username": "newuser",
            "email": "new@example.com",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "isDeleted": False
        })

        # Second call should use cache
        users2 = app.user_service.get_all_users()
        assert len(users2) == initial_count

    def test_cache_invalidation_on_update(self, app, mock_user_in_db):
        """Test cache invalidation after update"""
        user_id = mock_user_in_db._id
        
        # First get to cache
        user1 = app.user_service.get_user_by_id(user_id)
        
        # Update through service
        updated_user = app.user_service.update_user(user_id, {
            "username": "updated_name"
        })
        
        # Get again - should have new data
        user2 = app.user_service.get_user_by_id(user_id)
        assert user2.username == "updated_name"
        assert user2.username != user1.username

    def test_cache_invalidation_on_delete(self, app, mock_user_in_db):
        """Test cache invalidation after delete"""
        user_id = mock_user_in_db._id
        
        # First get to cache
        user = app.user_service.get_user_by_id(user_id)
        assert not user.isDeleted
        
        # Delete user
        app.user_service.delete_user(user_id)
        
        # Try to get user - should be not found
        with pytest.raises(APIError) as exc_info:
            app.user_service.get_user_by_id(user_id)
        assert exc_info.value.status_code == 404

    def test_cache_update_with_error(self, app, mock_user_in_db):
        """Test cache behavior when update fails"""
        user_id = mock_user_in_db._id
        original_email = mock_user_in_db.email
        
        # First get to cache
        user1 = app.user_service.get_user_by_id(user_id)
        
        # Try invalid update
        with pytest.raises(APIError):
            app.user_service.update_user(user_id, {
                "email": "invalid-email"
            })
        
        # Get again - should have original data
        user2 = app.user_service.get_user_by_id(user_id)
        assert user2.email == original_email

class TestUserOperations:
    """Tests for core user operations"""
    
    def test_create_user_success(self, app):
        """Test successful user creation"""
        user_data = {
            "username": "newuser",
            "email": "new@example.com"
        }
        user = app.user_service.create_user(user_data)
        
        assert isinstance(user, User)
        assert user.username == user_data['username']
        assert user.email == user_data['email']
        assert user._id is not None
        assert not user.isDeleted
        assert isinstance(user.created_at, datetime)
        assert isinstance(user.updated_at, datetime)

    def test_create_user_duplicate_email(self, app, mock_user_in_db):
        """Test user creation with duplicate email"""
        with pytest.raises(APIError) as exc_info:
            app.user_service.create_user({
                "username": "another_user",
                "email": mock_user_in_db.email
            })
        assert "Email already exists" in str(exc_info.value)
        assert exc_info.value.status_code == 400

    def test_get_user_by_id_success(self, app, mock_user_in_db):
        """Test getting a specific user by ID"""
        user = app.user_service.get_user_by_id(mock_user_in_db._id)
        assert user.email == mock_user_in_db.email
        assert isinstance(user, User)

    def test_get_user_by_id_not_found(self, app):
        """Test getting a non-existent user"""
        with pytest.raises(APIError) as exc_info:
            app.user_service.get_user_by_id(str(ObjectId()))
        assert "User not found" in str(exc_info.value)
        assert exc_info.value.status_code == 404

    def test_update_user_success(self, app, mock_user_in_db):
        """Test successful user update"""
        update_data = {
            "username": "updated_user",
            "email": "updated@example.com"
        }
        user = app.user_service.update_user(mock_user_in_db._id, update_data)
        assert user.username == update_data['username']
        assert user.email == update_data['email']

    def test_update_user_partial(self, app, mock_user_in_db):
        """Test partial update"""
        original_email = mock_user_in_db.email
        user = app.user_service.update_user(
            mock_user_in_db._id,
            {"username": "new_name"}
        )
        assert user.username == "new_name"
        assert user.email == original_email

    def test_delete_user_success(self, app, mock_user_in_db):
        """Test successful user deletion"""
        app.user_service.delete_user(mock_user_in_db._id)
        
        # Verify deletion
        with pytest.raises(APIError):
            app.user_service.get_user_by_id(mock_user_in_db._id)
            
        # Verify with include_deleted
        deleted_user = app.user_service.get_user_by_id(
            mock_user_in_db._id,
            include_deleted=True
        )
        assert deleted_user.isDeleted

    def test_delete_already_deleted_user(self, app, mock_user_in_db):
        """Test deleting an already deleted user"""
        app.user_service.delete_user(mock_user_in_db._id)
        with pytest.raises(APIError) as exc_info:
            app.user_service.delete_user(mock_user_in_db._id)
        assert "already deleted" in str(exc_info.value)

    def test_restore_user_success(self, app, mock_user_in_db):
        """Test successful user restoration"""
        # First delete the user
        app.user_service.delete_user(mock_user_in_db._id)
        
        # Then restore
        restored_user = app.user_service.restore_user(mock_user_in_db._id)
        assert not restored_user.isDeleted
        assert restored_user.email == mock_user_in_db.email

        # Verify restored state
        active_user = app.user_service.get_user_by_id(mock_user_in_db._id)
        assert not active_user.isDeleted

class TestUserValidation:
    """Tests for user data validation"""

    def test_validate_email_success(self, app):
        """Test valid email validation"""
        assert validate_email("test@example.com")
        assert validate_email("user.name+tag@domain.co.uk")

    def test_validate_email_failure(self, app):
        """Test invalid email validation"""
        assert not validate_email("invalid-email")
        assert not validate_email("@domain.com")
        assert not validate_email("user@.com")

    def test_validate_user_data_success(self, app):
        """Test valid user data validation"""
        data = {
            "username": "testuser",
            "email": "test@example.com"
        }
        # Should not raise any exception
        app.user_service.validate_user_data(data)

    def test_validate_user_data_missing_fields(self, app):
        """Test user data validation with missing fields"""
        with pytest.raises(APIError) as exc_info:
            app.user_service.validate_user_data({"username": "testuser"})
        assert "Missing required fields" in str(exc_info.value)
        assert exc_info.value.status_code == 400

    def test_validate_user_data_invalid_username(self, app):
        """Test validation with invalid username"""
        with pytest.raises(APIError) as exc_info:
            app.user_service.validate_user_data({
                "username": "ab",  # too short
                "email": "test@example.com"
            })
        assert "Username must be" in str(exc_info.value)

