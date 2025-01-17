import pandas as pd
import logging

from io import BytesIO, StringIO
from bson import ObjectId
from typing import Dict, List, Any
from datetime import datetime

from app.errors.exceptions import APIError


logger = logging.getLogger(__name__)

class FileService:
    """Service for handling file uploads and processing"""
    
    def __init__(self, db_service):
        """Initialize file service with database service"""
        self.db = db_service
        self.allowed_extensions = {'csv', 'xlsx', 'xls'}
        self.collection_name = 'files'

    def allowed_file(self, filename: str) -> bool:
        """Check if file extension is allowed"""
        return '.' in filename and \
            filename.rsplit('.', 1)[1].lower() in self.allowed_extensions

    def save_file_metadata(self, file_data: Dict) -> str:
        """Save file metadata to database"""
        try:
            file_data['created_at'] = datetime.utcnow()
            file_data['updated_at'] = datetime.utcnow()
            
            file_id = self.db.insert_one(file_data)
            logger.info(f"File metadata saved with ID: {file_id}")
            return file_id
            
        except Exception as e:
            logger.error(f"Error saving file metadata: {str(e)}")
            raise APIError(f"Error saving file metadata: {str(e)}", 500)

    def process_file(self, file_content: bytes, filename: str) -> Dict[str, Any]:
        """
        Process uploaded file content
        
        Args:
            file_content: Raw file content
            filename: Original filename
            
        Returns:
            Dict with processed data and metadata
        """
        try:
            # Determine file type
            file_extension = filename.rsplit('.', 1)[1].lower()
            
            # Create file-like object from bytes
            file_obj = BytesIO(file_content)
            
            # Read file based on type
            if file_extension == 'csv':
                # For CSV, we need to decode the bytes to string first
                text_content = file_content.decode('utf-8')
                df = pd.read_csv(StringIO(text_content))
            else:  # xlsx or xls
                df = pd.read_excel(file_obj)
            
            # Get basic file stats
            stats = {
                'row_count': len(df),
                'column_count': len(df.columns),
                'columns': df.columns.tolist(),
                'sample_data': df.head(5).to_dict('records')
            }
            
            # Create metadata
            metadata = {
                'filename': filename,
                'file_type': file_extension,
                'size_bytes': len(file_content),
                'stats': stats,
                'status': 'processed',
                'processed_at': datetime.utcnow().isoformat()
            }
            
            return metadata
            
        except Exception as e:
            logger.error(f"Error processing file: {str(e)}")
            raise APIError(f"Error processing file: {str(e)}", 500)

    def get_file_metadata(self, file_id: str) -> Dict:
        """Get file metadata by ID"""
        try:
            # Validate file_id format
            if not ObjectId.is_valid(file_id):
                raise APIError("Invalid file ID", 400)

            # Try to retrieve the file
            file_data = self.db.find_one({"_id": ObjectId(file_id)})
            if not file_data:
                raise APIError("File not found", 404)

            return file_data

        except APIError:
            raise
        except Exception as e:
            logger.error(f"Unexpected error retrieving file metadata: {str(e)}")
            raise APIError("Internal server error retrieving file metadata", 500)

    def get_all_files(self) -> List[Dict]:
        """Get all file metadata"""
        try:
            return list(self.db.find({}))
        except Exception as e:
            logger.error(f"Error getting files: {str(e)}")
            raise APIError(f"Error getting files: {str(e)}", 500)

    def delete_file(self, file_id: str) -> None:
        """Delete file metadata"""
        try:
            # Validate and convert file_id to ObjectId
            if not ObjectId.is_valid(file_id):
                raise APIError("Invalid file ID", 400)

            result = self.db.delete_one({"_id": ObjectId(file_id)})
            if result.deleted_count == 0:
                raise APIError("File not found", 404)

        except APIError:
            raise
        except Exception as e:
            logger.error(f"Error deleting file: {str(e)}")
            raise APIError(f"Error deleting file: {str(e)}", 500)