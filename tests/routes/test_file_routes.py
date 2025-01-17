import pytest

from io import BytesIO

class TestFileRoutes:
    """Test suite for file-related routes"""

    @pytest.fixture
    def valid_csv_file(self):
        """Fixture for a valid CSV file"""
        file_content = b"name,email,age\nJohn Doe,john@example.com,30\nJane Smith,jane@example.com,25"
        return BytesIO(file_content), "sample.csv"

    def test_upload_file_success(self, client, valid_csv_file, headers_multipart):
        """Test successful file upload"""
        file_obj, filename = valid_csv_file
        data = {'file': (file_obj, filename)}
        response = client.post('/api/files/upload', data=data, headers=headers_multipart)
        assert response.status_code == 201
        response_data = response.get_json()
        assert response_data["message"] == "File uploaded and processed successfully"
        assert "file_id" in response_data
        assert "metadata" in response_data

    def test_upload_file_no_file(self, client, headers_multipart):
        """Test file upload with no file"""
        response = client.post('/api/files/upload', data={}, headers=headers_multipart)
        assert response.status_code == 400
        response_data = response.get_json()
        assert response_data["message"] == "No file part"

    def test_get_files(self, client):
        """Test getting all files"""
        response = client.get('/api/files/')
        assert response.status_code == 200
        response_data = response.get_json()
        assert "files" in response_data
        assert "count" in response_data
        assert isinstance(response_data["files"], list)

    def test_get_file_by_id_success(self, client, valid_csv_file):
        """Test retrieving a file by ID"""
        file_obj, filename = valid_csv_file
        upload_response = client.post('/api/files/upload', data={'file': (file_obj, filename)}, headers={'Content-Type': 'multipart/form-data'})
        file_id = upload_response.get_json()["file_id"]

        response = client.get(f'/api/files/{file_id}')
        assert response.status_code == 200
        response_data = response.get_json()
        assert response_data["filename"] == filename

    def test_get_file_by_id_not_found(self, client):
        """Test retrieving a non-existent file by ID"""
        response = client.get('/api/files/6789c67dfc91b4d81fee6025')  
        assert response.status_code == 404 
        response_data = response.get_json()
        assert response_data["message"] == "File not found"

    def test_delete_file_success(self, client, valid_csv_file):
        """Test deleting a file"""
        file_obj, filename = valid_csv_file
        upload_response = client.post('/api/files/upload', data={'file': (file_obj, filename)}, headers={'Content-Type': 'multipart/form-data'})
        file_id = upload_response.get_json()["file_id"]

        response = client.delete(f'/api/files/{file_id}')
        assert response.status_code == 204

    def test_delete_file_not_found(self, client):
        """Test deleting a non-existent file"""
        response = client.delete('/api/files/invalid_id')
        assert response.status_code == 400
        response_data = response.get_json()
        assert response_data["message"] == "Invalid file ID"