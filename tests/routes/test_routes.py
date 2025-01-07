from bson import ObjectId
import pytest
import json

class TestCreateUser:
    def test_create_user_success(self, client, mock_user_data):
        """Test successful user creation"""
        response = client.post(
            '/api/users/',
            json=mock_user_data,
            headers={'Content-Type': 'application/json'}
        )
        assert response.status_code == 201
        assert 'user' in response.json

class TestGetUsers:
    def test_get_all_users_empty(self, client):
        """Test getting all users when DB is empty"""
        response = client.get(
            '/api/users/',
            headers={'Content-Type': 'application/json'}
        )
        assert response.status_code == 200
        assert response.json['users'] == []

    def test_get_all_users_with_data(self, client, mock_user_in_db):
        """Test getting all users with data in DB"""
        response = client.get(
            '/api/users/',
            headers={'Content-Type': 'application/json'}
        )
        assert response.status_code == 200
        assert len(response.json['users']) > 0

class TestGetUser:
    def test_get_user_by_id_success(self, client, mock_user_in_db):
        """Test getting a specific user by ID"""
        user_id = str(mock_user_in_db['_id'])
        response = client.get(
            f'/api/users/{user_id}',
            headers={'Content-Type': 'application/json'}
        )
        assert response.status_code == 200
        assert response.json['user']['id'] == user_id

    def test_get_user_not_found(self, client):
        """Test getting a non-existent user"""
        response = client.get(
            f'/api/users/{str(ObjectId())}',
            headers={'Content-Type': 'application/json'}
        )
        assert response.status_code == 404

    def test_get_user_invalid_id(self, client):
        """Test getting a user with invalid ID format"""
        response = client.get(
            '/api/users/invalid-id',
            headers={'Content-Type': 'application/json'}
        )
        assert response.status_code == 400

class TestUpdateUser:
    def test_update_user_success(self, client, mock_user_in_db):
        """Test successful user update"""
        user_id = str(mock_user_in_db['_id'])
        update_data = {"username": "updated_user"}
        response = client.put(
            f'/api/users/{user_id}',
            json=update_data,
            headers={'Content-Type': 'application/json'}
        )
        assert response.status_code == 200
        assert response.json['user']['username'] == "updated_user"

class TestDeleteUser:
    def test_delete_user_success(self, client, mock_user_in_db):
        """Test successful user deletion"""
        user_id = str(mock_user_in_db['_id'])
        response = client.delete(
            f'/api/users/{user_id}',
            headers={'Content-Type': 'application/json'}
        )
        assert response.status_code == 204

    def test_delete_already_deleted_user(self, client, mock_user_in_db):
        """Test deleting an already deleted user"""
        user_id = str(mock_user_in_db['_id'])
        client.delete(
            f'/api/users/{user_id}',
            headers={'Content-Type': 'application/json'}
        )
        response = client.delete(
            f'/api/users/{user_id}',
            headers={'Content-Type': 'application/json'}
        )
        assert response.status_code == 400

class TestRestoreUser:
    def test_restore_user_success(self, client, mock_user_in_db):
        """Test successful user restoration"""
        user_id = str(mock_user_in_db['_id'])
        # First delete the user
        client.delete(
            f'/api/users/{user_id}',
            headers={'Content-Type': 'application/json'}
        )
        # Then restore
        response = client.post(
            f'/api/users/{user_id}/restore',
            headers={'Content-Type': 'application/json'}
        )
        assert response.status_code == 200

    def test_restore_active_user(self, client, mock_user_in_db):
        """Test restoring an active user"""
        user_id = str(mock_user_in_db['_id'])
        response = client.post(
            f'/api/users/{user_id}/restore',
            headers={'Content-Type': 'application/json'}
        )
        assert response.status_code == 400