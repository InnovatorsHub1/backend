import pytest
from bson import ObjectId
import json
from datetime import datetime

class TestCreateUser:
    """Test user creation endpoint"""
    
    def test_create_user_success(self, client, mock_user_data, headers):
        """Test successful user creation"""
        response = client.post(
            '/api/users/',
            json=mock_user_data,
            headers=headers
        )
        assert response.status_code == 201
        
        data = json.loads(response.data)
        assert 'user' in data
        assert data['user']['username'] == mock_user_data['username']
        assert data['user']['email'] == mock_user_data['email']
        assert not data['user']['isDeleted']
        assert 'id' in data['user']

        # Verify cache invalidation by getting all users
        get_response = client.get('/api/users/', headers=headers)
        assert get_response.status_code == 200
        all_users = json.loads(get_response.data)['users']
        assert len(all_users) == 1
        assert any(u['email'] == mock_user_data['email'] for u in all_users)

    def test_create_user_missing_data(self, client, headers):
        """Test user creation with missing data"""
        response = client.post(
            '/api/users/',
            json={},
            headers=headers
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert "No input data provided" in data['message']

    def test_create_user_duplicate_email(self, client, mock_user_in_db, mock_user_data, headers):
        """Test user creation with duplicate email"""
        response = client.post(
            '/api/users/',
            json=mock_user_data,  # Same email as mock_user_in_db
            headers=headers
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert "Email already exists" in data['message']

class TestGetUsers:
    """Test user retrieval endpoints"""

    def test_get_all_users_empty(self, client, headers):
        """Test getting all users when DB is empty"""
        response = client.get('/api/users/', headers=headers)
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'users' in data
        assert len(data['users']) == 0

    def test_get_all_users_with_data(self, client, mock_user_in_db, headers):
        """Test getting all users with data in DB"""
        # First request to cache
        response1 = client.get('/api/users/', headers=headers)
        assert response1.status_code == 200
        data1 = json.loads(response1.data)
        assert len(data1['users']) == 1

        # Second request should use cache
        response2 = client.get('/api/users/', headers=headers)
        data2 = json.loads(response2.data)
        assert data2 == data1  # Should be identical

    def test_get_users_include_deleted(self, client, mock_user_in_db, headers):
        """Test getting users including deleted ones"""
        # First delete the user
        delete_response = client.delete(
            f'/api/users/{mock_user_in_db._id}',
            headers=headers
        )
        assert delete_response.status_code == 204

        # Get users without include_deleted
        response1 = client.get('/api/users/', headers=headers)
        data1 = json.loads(response1.data)
        assert len(data1['users']) == 0

        # Get users with include_deleted
        response2 = client.get(
            '/api/users/?include_deleted=true',
            headers=headers
        )
        data2 = json.loads(response2.data)
        assert len(data2['users']) == 1
        assert data2['users'][0]['isDeleted'] is True

class TestGetUser:
    """Test single user retrieval endpoint"""

    def test_get_user_by_id_success(self, client, mock_user_in_db, headers):
        """Test getting a specific user by ID"""
        # First request to cache
        response1 = client.get(
            f'/api/users/{mock_user_in_db._id}',
            headers=headers
        )
        assert response1.status_code == 200
        data1 = json.loads(response1.data)
        assert data1['user']['email'] == mock_user_in_db.email

        # Second request should use cache
        response2 = client.get(
            f'/api/users/{mock_user_in_db._id}',
            headers=headers
        )
        data2 = json.loads(response2.data)
        assert data2 == data1  # Should be identical

    def test_get_user_not_found(self, client, headers):
        """Test getting a non-existent user"""
        response = client.get(
            f'/api/users/{str(ObjectId())}',
            headers=headers
        )
        assert response.status_code == 404
        data = json.loads(response.data)
        assert "User not found" in data['message']

    def test_get_deleted_user(self, client, mock_user_in_db, headers):
        """Test getting a deleted user"""
        # Delete the user
        client.delete(f'/api/users/{mock_user_in_db._id}', headers=headers)

        # Try to get without include_deleted
        response1 = client.get(
            f'/api/users/{mock_user_in_db._id}',
            headers=headers
        )
        assert response1.status_code == 404

        # Get with include_deleted
        response2 = client.get(
            f'/api/users/{mock_user_in_db._id}?include_deleted=true',
            headers=headers
        )
        assert response2.status_code == 200
        data = json.loads(response2.data)
        assert data['user']['isDeleted'] is True

class TestUpdateUser:
    """Test user update endpoint"""

    def test_update_user_success(self, client, mock_user_in_db, headers):
        """Test successful user update"""
        update_data = {
            "username": "updated_user",
            "email": "updated@example.com"
        }
        response = client.put(
            f'/api/users/{mock_user_in_db._id}',
            json=update_data,
            headers=headers
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['user']['username'] == update_data['username']

        # Verify cache is invalidated
        get_response = client.get(
            f'/api/users/{mock_user_in_db._id}',
            headers=headers
        )
        get_data = json.loads(get_response.data)
        assert get_data['user']['username'] == update_data['username']

    def test_update_user_partial(self, client, mock_user_in_db, headers):
        """Test partial user update"""
        update_data = {"username": "new_name"}
        response = client.put(
            f'/api/users/{mock_user_in_db._id}',
            json=update_data,
            headers=headers
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['user']['username'] == "new_name"
        assert data['user']['email'] == mock_user_in_db.email

class TestDeleteUser:
    """Test user deletion endpoint"""

    def test_delete_user_success(self, client, mock_user_in_db, headers):
        """Test successful user deletion"""
        response = client.delete(
            f'/api/users/{mock_user_in_db._id}',
            headers=headers
        )
        assert response.status_code == 204

        # Verify cache is invalidated
        get_response = client.get(
            f'/api/users/{mock_user_in_db._id}',
            headers=headers
        )
        assert get_response.status_code == 404

    def test_delete_already_deleted_user(self, client, mock_user_in_db, headers):
        """Test deleting an already deleted user"""
        # First delete
        client.delete(f'/api/users/{mock_user_in_db._id}', headers=headers)

        # Try to delete again
        response = client.delete(
            f'/api/users/{mock_user_in_db._id}',
            headers=headers
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert "User is already deleted" in data['message']

class TestRestoreUser:
    """Test user restoration endpoint"""

    def test_restore_user_success(self, client, mock_user_in_db, headers):
        """Test successful user restoration"""
        # First delete
        client.delete(f'/api/users/{mock_user_in_db._id}', headers=headers)

        # Then restore
        response = client.post(
            f'/api/users/{mock_user_in_db._id}/restore',
            headers=headers
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        assert not data['user']['isDeleted']

        # Verify cache is invalidated
        get_response = client.get(
            f'/api/users/{mock_user_in_db._id}',
            headers=headers
        )
        assert get_response.status_code == 200
        get_data = json.loads(get_response.data)
        assert not get_data['user']['isDeleted']

    def test_restore_active_user(self, client, mock_user_in_db, headers):
        """Test restoring an active user"""
        response = client.post(
            f'/api/users/{mock_user_in_db._id}/restore',
            headers=headers
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert "User is not deleted" in data['message']