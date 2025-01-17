import pytest

from app.errors.exceptions import APIError

class TestFileService:
    """Test suite for FileService"""

    @pytest.fixture
    def valid_csv_content(self):
        """Fixture for valid CSV file content"""
        return b"name,email,age\nJohn Doe,john@example.com,30\nJane Smith,jane@example.com,25"

    @pytest.fixture
    def valid_filename(self):
        """Fixture for valid filename"""
        return "sample.csv"

    def test_allowed_file(self, mock_file_service):
        """Test allowed file extensions"""
        assert mock_file_service.allowed_file("test.csv") is True
        assert mock_file_service.allowed_file("test.xlsx") is True
        assert mock_file_service.allowed_file("test.txt") is False

    def test_process_file_csv(self, mock_file_service, valid_csv_content, valid_filename):
        """Test processing a valid CSV file"""
        metadata = mock_file_service.process_file(valid_csv_content, valid_filename)
        assert metadata["file_type"] == "csv"
        assert metadata["stats"]["row_count"] == 2
        assert metadata["stats"]["columns"] == ["name", "email", "age"]

    def test_process_file_invalid_extension(self, mock_file_service):
        """Test processing a file with an invalid extension"""
        with pytest.raises(APIError):
            mock_file_service.process_file(b"dummy content", "test.txt")

    def test_save_file_metadata(self, mock_file_service):
        """Test saving file metadata"""
        metadata = {"filename": "sample.csv", "file_type": "csv"}
        file_id = mock_file_service.save_file_metadata(metadata)
        assert isinstance(file_id, str)

    def test_get_file_metadata_success(self, mock_file_service):
        """Test retrieving file metadata"""
        metadata = {"filename": "sample.csv", "file_type": "csv"}
        file_id = mock_file_service.save_file_metadata(metadata)
        retrieved_metadata = mock_file_service.get_file_metadata(file_id)
        assert retrieved_metadata["filename"] == metadata["filename"]

    def test_get_file_metadata_not_found(self, mock_file_service):
        """Test retrieving metadata for a non-existent file"""
        with pytest.raises(APIError):
            mock_file_service.get_file_metadata("invalid_id")

    def test_delete_file_success(self, mock_file_service):
        """Test deleting file metadata"""
        metadata = {"filename": "sample.csv", "file_type": "csv"}
        file_id = mock_file_service.save_file_metadata(metadata)
        mock_file_service.delete_file(file_id)
        with pytest.raises(APIError):
            mock_file_service.get_file_metadata(file_id)

    def test_delete_file_not_found(self, mock_file_service):
        """Test deleting a non-existent file"""
        with pytest.raises(APIError) as exc_info:
            mock_file_service.delete_file("6789c67dfc91b4d81fee6025")
        assert "File not found" in str(exc_info.value)