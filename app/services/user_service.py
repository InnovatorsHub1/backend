from app import mongo
from app.models.user import User
from app.errors.exceptions import APIError
from bson import ObjectId
from bson.errors import InvalidId
from typing import List, Optional, Dict, Any
from datetime import datetime
import re

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
                raise APIError("Missing required fields: username and email", 400)

        if "email" in data and not UserService.validate_email(data["email"]):
            raise APIError("Invalid email format", 400)

        if "username" in data and (not isinstance(data["username"], str) or len(data["username"]) < 3):
            raise APIError("Username must be a string with at least 3 characters", 400)

    @staticmethod
    def create_user(user_data: Dict[str, Any]) -> User:
        try:
            # Validate input data
            UserService.validate_user_data(user_data)

            # Check if user exists
            if mongo.db.users.find_one({"email": user_data["email"], "isDeleted": False}):
                raise APIError("Email already exists", 400)
            
            user = User(**user_data)
            result = mongo.db.users.insert_one(user.to_dict())
            user._id = str(result.inserted_id)
            return user

        except APIError:
            raise
        except Exception as e:
            raise APIError(f"Error creating user: {str(e)}", 500)

    @staticmethod
    def get_all_users(include_deleted: bool = False) -> List[User]:
        try:
            query = {} if include_deleted else {"isDeleted": False}
            users = mongo.db.users.find(query)
            return [User.from_dict(user) for user in users]
        except Exception as e:
            raise APIError(f"Error fetching users: {str(e)}", 500)

    @staticmethod
    def get_user_by_id(user_id: str, include_deleted: bool = False) -> User:
        try:
            query = {"_id": ObjectId(user_id)}
            if not include_deleted:
                query["isDeleted"] = False
                
            user = mongo.db.users.find_one(query)
            if not user:
                raise APIError("User not found", 404)
                
            return User.from_dict(user)
        except InvalidId:
            raise APIError("Invalid user ID format", 400)
        except APIError:
            raise
        except Exception as e:
            raise APIError(f"Error fetching user: {str(e)}", 500)

    @staticmethod
    def update_user(user_id: str, user_data: Dict[str, Any]) -> User:
        try:
            # Validate input data
            UserService.validate_user_data(user_data, is_update=True)

            # Check if user exists and get current user data
            current_user = UserService.get_user_by_id(user_id)

            # Check email uniqueness if email is being updated
            if "email" in user_data and user_data["email"] != current_user.email:
                if mongo.db.users.find_one({
                    "email": user_data["email"], 
                    "_id": {"$ne": ObjectId(user_id)},
                    "isDeleted": False
                }):
                    raise APIError("Email already exists", 400)

            # Update user
            user_data["updated_at"] = datetime.utcnow()
            result = mongo.db.users.update_one(
                {"_id": ObjectId(user_id), "isDeleted": False},
                {"$set": user_data}
            )
            
            if result.modified_count == 0:
                raise APIError("Failed to update user", 400)

            return UserService.get_user_by_id(user_id)

        except InvalidId:
            raise APIError("Invalid user ID format", 400)
        except APIError:
            raise
        except Exception as e:
            raise APIError(f"Error updating user: {str(e)}", 500)

    @staticmethod
    def delete_user(user_id: str) -> None:
        try:
            # Check if user exists
            user = mongo.db.users.find_one({"_id": ObjectId(user_id)})
            if not user:
                raise APIError("User with this ID does not exist", 404)
            
            # Check if user is already deleted
            if user.get('isDeleted', False):
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
                raise APIError("Failed to delete user", 400)

        except InvalidId:
            raise APIError("Invalid user ID format", 400)
        except APIError:
            raise
        except Exception as e:
            raise APIError(f"Error deleting user: {str(e)}", 500)

    @staticmethod
    def restore_user(user_id: str) -> User:
        try:
            # Check if user exists
            user = mongo.db.users.find_one({"_id": ObjectId(user_id)})
            if not user:
                raise APIError("User with this ID does not exist", 404)
            
            # Check if user is actually deleted
            if not user.get('isDeleted', False):
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
                raise APIError("Failed to restore user", 400)

            return UserService.get_user_by_id(user_id)

        except InvalidId:
            raise APIError("Invalid user ID format", 400)
        except APIError:
            raise
        except Exception as e:
            raise APIError(f"Error restoring user: {str(e)}", 500)