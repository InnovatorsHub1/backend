import logging

from bson import ObjectId
from flask import Blueprint, request, jsonify, current_app

from app.errors.exceptions import APIError


logger = logging.getLogger(__name__)
file_bp = Blueprint('files', __name__, url_prefix='/api/files')

@file_bp.route('/upload', methods=['POST'])
def upload_file():
    """Upload and process a file"""
    try:
        # Check if file was uploaded
        if 'file' not in request.files:
            raise APIError("No file part", 400)
            
        file = request.files['file']
        if file.filename == '':
            raise APIError("No selected file", 400)
            
        # Validate file extension
        if not current_app.file_service.allowed_file(file.filename):
            raise APIError("File type not allowed", 400)
            
        # Process file
        file_content = file.read()
        metadata = current_app.file_service.process_file(file_content, file.filename)
        
        # Save metadata to database
        file_id = current_app.file_service.save_file_metadata(metadata)
        
        response_data = {
            "message": "File uploaded and processed successfully",
            "file_id": file_id,  # Will be automatically converted by MongoJSONEncoder
            "metadata": metadata
        }
        
        return jsonify(response_data), 201
        
    except APIError:
        raise
    except Exception as e:
        logger.error(f"Error uploading file: {str(e)}")
        raise APIError("Error uploading file", 500)

@file_bp.route('/', methods=['GET'])
def get_files():
    """Get all files metadata"""
    try:
        files = current_app.file_service.get_all_files()
        return jsonify({
            "files": files,  # Will be automatically converted by MongoJSONEncoder
            "count": len(files)
        }), 200
        
    except APIError:
        raise
    except Exception as e:
        logger.error(f"Error getting files: {str(e)}")
        raise APIError("Error getting files", 500)

@file_bp.route('/<file_id>', methods=['GET'])
def get_file(file_id):
    """Get file metadata by ID"""
    try:
        file_data = current_app.file_service.get_file_metadata(file_id)
        return jsonify(file_data), 200

    except APIError as e:
        return jsonify({"message": e.message}), e.status_code
    except Exception as e:
        logger.error(f"Unexpected error retrieving file: {str(e)}")
        return jsonify({"message": "Internal server error"}), 500

@file_bp.route('/<file_id>', methods=['DELETE'])
def delete_file(file_id):
    """Delete file metadata"""
    try:
        current_app.file_service.delete_file(file_id)
        return "", 204
        
    except APIError:
        raise
    except Exception as e:
        logger.error(f"Error deleting file: {str(e)}")
        raise APIError("Error deleting file", 500)