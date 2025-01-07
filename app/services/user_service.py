from app import mongo
from app.models.user import User
from app.errors.exceptions import APIError
from bson import ObjectId
from bson.errors import InvalidId
from typing import List, Optional, Dict, Any
from datetime import datetime
import re
import logging

logger = logging.getLogger(__name__)

class UserService:
    @staticmethod
    def validate_email(email: str) -> bool:
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return bool(re.match(pattern, email))

    @staticmethod
    def validate_user_data(data: Dict[str, Any], is_update: bool = False) -> None:
        if not is_update:
            required_fields = ["username", "email"]
            if not all(field in data for field in required_fields):
                logger.warning(f"Validation failed: Missing required fields")
                raise APIError("Missing required fields: username and email", 400)

        if "email" in data and not UserService.validate_email(data["email"]):
            logger.warning(f"Validation failed: Invalid email format - {data.get('email')}")
            raise APIError("Invalid email format", 400)

        if "username" in data and (not isinstance(data["username"], str) or len(data["username"]) < 3):
            logger.warning(f"Validation failed: Invalid username format - {data.get('username')}")
            raise APIError("Username must be a string with at least 3 characters", 400)

    @staticmethod
    def create_user(user_data: Dict[str, Any]) -> User:
        try:
            logger.info(f"Attempting to create user with email: {user_data.get('email')}")
            
            # Validate input data
            UserService.validate_user_data(user_data)

            # Check if user exists
            if mongo.db.users.find_one({"email": user_data["email"], "isDeleted": False}):
                logger.warning(f"User creation failed: Email already exists - {user_data.get('email')}")
                raise APIError("Email already exists", 400)
            
            user = User(**user_data)
            result = mongo.db.users.insert_one(user.to_dict())
            user._id = str(result.inserted_id)
            
            logger.info(f"Successfully created user with ID: {user._id}")
            return user

        except APIError:
            raise
        except Exception as e:
            logger.error(f"Error creating user: {str(e)}", exc_info=True)
            raise APIError(f"Error creating user: {str(e)}", 500)

    @staticmethod
    def get_all_users(include_deleted: bool = False) -> List[User]:
        try:
            logger.info(f"Fetching all users (include_deleted={include_deleted})")
            
            query = {} if include_deleted else {"isDeleted": False}
            users = mongo.db.users.find(query)
            user_list = [User.from_dict(user) for user in users]
            
            logger.info(f"Successfully retrieved {len(user_list)} users")
            return user_list
            
        except Exception as e:
            logger.error(f"Error fetching users: {str(e)}", exc_info=True)
            raise APIError(f"Error fetching users: {str(e)}", 500)

    @staticmethod
    def get_user_by_id(user_id: str, include_deleted: bool = False) -> User:
        try:
            logger.info(f"Fetching user with ID: {user_id}")
            
            query = {"_id": ObjectId(user_id)}
            if not include_deleted:
                query["isDeleted"] = False
                
            user = mongo.db.users.find_one(query)
            if not user:
                logger.warning(f"User not found with ID: {user_id}")
                raise APIError("User not found", 404)
            
            logger.debug(f"Successfully retrieved user: {user_id}")    
            return User.from_dict(user)
            
        except InvalidId:
            logger.error(f"Invalid user ID format: {user_id}")
            raise APIError("Invalid user ID format", 400)
        except APIError:
            raise
        except Exception as e:
            logger.error(f"Error fetching user: {str(e)}", exc_info=True)
            raise APIError(f"Error fetching user: {str(e)}", 500)

    @staticmethod
    def update_user(user_id: str, user_data: Dict[str, Any]) -> User:
        try:
            logger.info(f"Attempting to update user with ID: {user_id}")
            
            # Validate input data
            UserService.validate_user_data(user_data, is_update=True)

            # Check if user exists and get current user data
            current_user = UserService.get_user_by_id(user_id)

            # Check email uniqueness if email is being updated
            if "email" in user_data and user_data["email"] != current_user.email:
                logger.debug(f"Checking email uniqueness for: {user_data['email']}")
                if mongo.db.users.find_one({
                    "email": user_data["email"], 
                    "_id": {"$ne": ObjectId(user_id)},
                    "isDeleted": False
                }):
                    logger.warning(f"Update failed: Email already exists - {user_data['email']}")
                    raise APIError("Email already exists", 400)

            # Update user
            user_data["updated_at"] = datetime.utcnow()
            result = mongo.db.users.update_one(
                {"_id": ObjectId(user_id), "isDeleted": False},
                {"$set": user_data}
            )
            
            if result.modified_count == 0:
                logger.error(f"Failed to update user: {user_id}")
                raise APIError("Failed to update user", 400)

            updated_user = UserService.get_user_by_id(user_id)
            logger.info(f"Successfully updated user: {user_id}")
            return updated_user

        except InvalidId:
            logger.error(f"Invalid user ID format: {user_id}")
            raise APIError("Invalid user ID format", 400)
        except APIError:
            raise
        except Exception as e:
            logger.error(f"Error updating user: {str(e)}", exc_info=True)
            raise APIError(f"Error updating user: {str(e)}", 500)

    @staticmethod
    def delete_user(user_id: str) -> None:
        try:
            logger.info(f"Attempting to delete user with ID: {user_id}")
            
            # Check if user exists
            user = mongo.db.users.find_one({"_id": ObjectId(user_id)})
            if not user:
                logger.warning(f"Delete failed: User not found with ID: {user_id}")
                raise APIError("User with this ID does not exist", 404)
            
            # Check if user is already deleted
            if user.get('isDeleted', False):
                logger.warning(f"Delete failed: User already deleted: {user_id}")
                raise APIError("User is already deleted", 400)

            # Perform soft delete
            result = mongo.db.users.update_one(
                {"_id": ObjectId(user_id), "isDeleted": False},
                {
                    "$set": {
                        "isDeleted": True,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            
            if result.modified_count == 0:
                logger.error(f"Failed to delete user: {user_id}")
                raise APIError("Failed to delete user", 400)

            logger.info(f"Successfully deleted user: {user_id}")

        except InvalidId:
            logger.error(f"Invalid user ID format: {user_id}")
            raise APIError("Invalid user ID format", 400)
        except APIError:
            raise
        except Exception as e:
            logger.error(f"Error deleting user: {str(e)}", exc_info=True)
            raise APIError(f"Error deleting user: {str(e)}", 500)

    @staticmethod
    def restore_user(user_id: str) -> User:
        try:
            logger.info(f"Attempting to restore user with ID: {user_id}")
            
            # Check if user exists
            user = mongo.db.users.find_one({"_id": ObjectId(user_id)})
            if not user:
                logger.warning(f"Restore failed: User not found with ID: {user_id}")
                raise APIError("User with this ID does not exist", 404)
            
            # Check if user is actually deleted
            if not user.get('isDeleted', False):
                logger.warning(f"Restore failed: User is not deleted: {user_id}")
                raise APIError("User is not deleted", 400)

            # Restore user
            result = mongo.db.users.update_one(
                {"_id": ObjectId(user_id), "isDeleted": True},
                {
                    "$set": {
                        "isDeleted": False,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            
            if result.modified_count == 0:
                logger.error(f"Failed to restore user: {user_id}")
                raise APIError("Failed to restore user", 400)

            restored_user = UserService.get_user_by_id(user_id, include_deleted=True)
            logger.info(f"Successfully restored user: {user_id}")
            return restored_user

        except InvalidId:
            logger.error(f"Invalid user ID format: {user_id}")
            raise APIError("Invalid user ID format", 400)
        except APIError:
            raise
        except Exception as e:
            logger.error(f"Error restoring user: {str(e)}", exc_info=True)
            raise APIError(f"Error restoring user: {str(e)}", 500)