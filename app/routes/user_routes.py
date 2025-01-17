import logging

from flask import Blueprint, jsonify, request, current_app

from app.errors.exceptions import APIError


logger = logging.getLogger(__name__)
user_bp = Blueprint("users", __name__, url_prefix="/api/users")

@user_bp.route("/", methods=["POST"])
def create_user():
    """Create a new user"""
    try:
        logger.info("Received request to create new user")
        data = request.get_json(force=True)
        
        if not data:
            logger.warning("Create user request failed: No input data provided")
            raise APIError("No input data provided", 400)

        logger.debug(f"Creating user with data: {data}")
        user = current_app.user_service.create_user(data)
        
        logger.info(f"Successfully created user with ID: {user._id}")
        return jsonify({"user": user.to_response_dict()}), 201

    except APIError as e:
        logger.warning(f"API Error in create_user: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error in create_user: {str(e)}", exc_info=True)
        raise APIError(str(e), 500)

@user_bp.route("/", methods=["GET"])
def get_users():
    """Get all users"""
    try:
        logger.info("Received request to get all users")
        include_deleted = request.args.get('include_deleted', '').lower() == 'true'
        
        logger.debug(f"Fetching users with include_deleted={include_deleted}")
        users = current_app.user_service.get_all_users(include_deleted)
        
        logger.info(f"Successfully retrieved {len(users)} users")
        return jsonify({
            "users": [user.to_response_dict() for user in users]
        }), 200

    except APIError as e:
        logger.warning(f"API Error in get_users: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error in get_users: {str(e)}", exc_info=True)
        raise APIError(str(e), 500)

@user_bp.route("/<user_id>", methods=["GET"])
def get_user(user_id):
    """Get a specific user by ID"""
    try:
        logger.info(f"Received request to get user with ID: {user_id}")
        include_deleted = request.args.get('include_deleted', '').lower() == 'true'
        
        user = current_app.user_service.get_user_by_id(user_id, include_deleted)
        logger.info(f"Successfully retrieved user: {user_id}")
        
        return jsonify({"user": user.to_response_dict()}), 200

    except APIError as e:
        logger.warning(f"API Error in get_user: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error in get_user: {str(e)}", exc_info=True)
        raise APIError(str(e), 500)

@user_bp.route("/<user_id>", methods=["PUT"])
def update_user(user_id):
    """Update a specific user"""
    try:
        logger.info(f"Received request to update user with ID: {user_id}")
        data = request.get_json(force=True)
        
        if not data:
            logger.warning("Update user request failed: No input data provided")
            raise APIError("No input data provided", 400)

        logger.debug(f"Updating user {user_id} with data: {data}")
        user = current_app.user_service.update_user(user_id, data)
        
        logger.info(f"Successfully updated user: {user_id}")
        return jsonify({"user": user.to_response_dict()}), 200

    except APIError as e:
        logger.warning(f"API Error in update_user: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error in update_user: {str(e)}", exc_info=True)
        raise APIError(str(e), 500)

@user_bp.route("/<user_id>", methods=["DELETE"])
def delete_user(user_id):
    """Delete a user"""
    try:
        logger.info(f"Received request to delete user with ID: {user_id}")
        current_app.user_service.delete_user(user_id)
        logger.info(f"Successfully deleted user: {user_id}")
        return "", 204

    except APIError as e:
        logger.warning(f"API Error in delete_user: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error in delete_user: {str(e)}", exc_info=True)
        raise APIError(str(e), 500)

@user_bp.route("/<user_id>/restore", methods=["POST"])
def restore_user(user_id):
    """Restore a deleted user"""
    try:
        logger.info(f"Received request to restore user with ID: {user_id}")
        user = current_app.user_service.restore_user(user_id)
        logger.info(f"Successfully restored user: {user_id}")
        return jsonify({"user": user.to_response_dict()}), 200

    except APIError as e:
        logger.warning(f"API Error in restore_user: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error in restore_user: {str(e)}", exc_info=True)
        raise APIError(str(e), 500)