import pytest
from bson import ObjectId

class TestCreateUser:
    def test_create_user_success(self, client, mock_user_data):
        """Test successful user creation"""
        response = client.post('/api/users/', json=mock_user_data)
        assert response.status_code == 201
        
        data = response.get_json()
        assert 'user' in data
        assert data['user']['username'] == mock_user_data['username']
        assert data['user']['email'] == mock_user_data['email']
        assert not data['user']['isDeleted']

    def test_create_user_missing_data(self, client):
        """Test user creation with missing data"""
        response = client.post('/api/users/', json={"username": "test"})
        assert response.status_code == 400
        assert "Missing required fields" in response.get_json()["message"]

    def test_create_user_invalid_email(self, client, mock_user_data):
        """Test user creation with invalid email"""
        invalid_data = mock_user_data.copy()
        invalid_data['email'] = "invalid-email"
        response = client.post('/api/users/', json=invalid_data)
        assert response.status_code == 400
        assert "Invalid email format" in response.get_json()["message"]

class TestGetUsers:
    def test_get_all_users_empty(self, client):
        """Test getting all users when DB is empty"""
        response = client.get('/api/users/')
        assert response.status_code == 200
        data = response.get_json()
        assert 'users' in data
        assert len(data['users']) == 0

    def test_get_all_users_with_data(self, client, mock_user_in_db):
        """Test getting all users with data in DB"""
        response = client.get('/api/users/')
        assert response.status_code == 200
        data = response.get_json()
        assert len(data['users']) > 0
        assert data['users'][0]['email'] == mock_user_in_db['email']

class TestGetUser:
    def test_get_user_by_id_success(self, client, mock_user_in_db):
        """Test getting a specific user by ID"""
        user_id = str(mock_user_in_db['_id'])
        response = client.get(f'/api/users/{user_id}')
        assert response.status_code == 200
        data = response.get_json()
        assert data['user']['email'] == mock_user_in_db['email']

    def test_get_user_not_found(self, client):
        """Test getting a non-existent user"""
        response = client.get(f'/api/users/{str(ObjectId())}')
        assert response.status_code == 404
        assert "User not found" in response.get_json()["message"]

    def test_get_user_invalid_id(self, client):
        """Test getting a user with invalid ID format"""
        response = client.get('/api/users/invalid-id')
        assert response.status_code == 400
        assert "Invalid user ID format" in response.get_json()["message"]

class TestUpdateUser:
    def test_update_user_success(self, client, mock_user_in_db):
        """Test successful user update"""
        user_id = str(mock_user_in_db['_id'])
        update_data = {
            "username": "updated_user",
            "email": "updated@example.com"
        }
        response = client.put(f'/api/users/{user_id}', json=update_data)
        assert response.status_code == 200
        data = response.get_json()
        assert data['user']['username'] == update_data['username']
        assert data['user']['email'] == update_data['email']

    def test_update_user_invalid_email(self, client, mock_user_in_db):
        """Test user update with invalid email"""
        user_id = str(mock_user_in_db['_id'])
        response = client.put(f'/api/users/{user_id}', json={"email": "invalid-email"})
        assert response.status_code == 400
        assert "Invalid email format" in response.get_json()["message"]

class TestDeleteUser:
    def test_delete_user_success(self, client, mock_user_in_db):
        """Test successful user deletion"""
        user_id = str(mock_user_in_db['_id'])
        response = client.delete(f'/api/users/{user_id}')
        assert response.status_code == 204

        # Verify user is deleted
        get_response = client.get(f'/api/users/{user_id}')
        assert get_response.status_code == 404

    def test_delete_already_deleted_user(self, client, mock_user_in_db):
        """Test deleting an already deleted user"""
        user_id = str(mock_user_in_db['_id'])
        client.delete(f'/api/users/{user_id}')  # First delete
        response = client.delete(f'/api/users/{user_id}')  # Second delete
        assert response.status_code == 400
        assert "already deleted" in response.get_json()["message"]

class TestRestoreUser:
    def test_restore_user_success(self, client, mock_user_in_db):
        """Test successful user restoration"""
        user_id = str(mock_user_in_db['_id'])
        # First delete the user
        client.delete(f'/api/users/{user_id}')
        # Then restore
        response = client.post(f'/api/users/{user_id}/restore')
        assert response.status_code == 200
        data = response.get_json()
        assert not data['user']['isDeleted']

    def test_restore_active_user(self, client, mock_user_in_db):
        """Test restoring an active user"""
        user_id = str(mock_user_in_db['_id'])
        response = client.post(f'/api/users/{user_id}/restore')
        assert response.status_code == 400
        assert "not deleted" in response.get_json()["message"]