from app import mongo
from app.models.user import User
from bson import ObjectId
from bson.errors import InvalidId
from typing import List, Optional, Tuple, Dict, Any
from datetime import datetime
import re

class UserService:
    @staticmethod
    def validate_email(email: str) -> bool:
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return bool(re.match(pattern, email))

    @staticmethod
    def validate_user_data(data: Dict[str, Any], is_update: bool = False) -> Optional[str]:
        if not is_update:
            required_fields = ["username", "email"]
            if not all(field in data for field in required_fields):
                return "Missing required fields: username and email"

        if "email" in data and not UserService.validate_email(data["email"]):
            return "Invalid email format"

        if "username" in data and (not isinstance(data["username"], str) or len(data["username"]) < 3):
            return "Username must be a string with at least 3 characters"

        return None

    @staticmethod
    def create_user(user_data: Dict[str, Any]) -> Tuple[Optional[User], Optional[str]]:
        try:
            # Validate input data
            validation_error = UserService.validate_user_data(user_data)
            if validation_error:
                return None, validation_error

            # Check if user exists
            if mongo.db.users.find_one({"email": user_data["email"], "isDeleted": False}):
                return None, "Email already exists"
            
            user = User(**user_data)
            result = mongo.db.users.insert_one(user.to_dict())
            user._id = str(result.inserted_id)
            return user, None

        except Exception as e:
            return None, f"Error creating user: {str(e)}"

    @staticmethod
    def get_all_users(include_deleted: bool = False) -> Tuple[List[User], Optional[str]]:
        try:
            query = {} if include_deleted else {"isDeleted": False}
            users = mongo.db.users.find(query)
            return [User.from_dict(user) for user in users], None
        except Exception as e:
            return [], f"Error fetching users: {str(e)}"

    @staticmethod
    def get_user_by_id(user_id: str, include_deleted: bool = False) -> Tuple[Optional[User], Optional[str]]:
        try:
            query = {"_id": ObjectId(user_id)}
            if not include_deleted:
                query["isDeleted"] = False
                
            user = mongo.db.users.find_one(query)
            if not user:
                return None, "User not found"
                
            return User.from_dict(user), None
        except InvalidId:
            return None, "Invalid user ID format"
        except Exception as e:
            return None, f"Error fetching user: {str(e)}"

    @staticmethod
    def update_user(user_id: str, user_data: Dict[str, Any]) -> Tuple[Optional[User], Optional[str]]:
        try:
            # Validate input data
            validation_error = UserService.validate_user_data(user_data, is_update=True)
            if validation_error:
                return None, validation_error

            # Check if user exists
            user, error = UserService.get_user_by_id(user_id)
            if error:
                return None, error

            # Check email uniqueness if email is being updated
            if "email" in user_data and user_data["email"] != user.email:
                if mongo.db.users.find_one({
                    "email": user_data["email"], 
                    "_id": {"$ne": ObjectId(user_id)},
                    "isDeleted": False
                }):
                    return None, "Email already exists"

            # Update user
            user_data["updated_at"] = datetime.utcnow()
            result = mongo.db.users.update_one(
                {"_id": ObjectId(user_id), "isDeleted": False},
                {"$set": user_data}
            )
            
            if result.modified_count:
                return UserService.get_user_by_id(user_id)[0], None
            return None, "Failed to update user"

        except InvalidId:
            return None, "Invalid user ID format"
        except Exception as e:
            return None, f"Error updating user: {str(e)}"

    @staticmethod
    def delete_user(user_id: str) -> Tuple[bool, Optional[str]]:
        try:
            # First check if user exists at all
            user = mongo.db.users.find_one({"_id": ObjectId(user_id)})
            if not user:
                return False, "User with this ID does not exist"
            
            # Then check if user is already deleted
            if user.get('isDeleted', False):
                return False, "User is already deleted"

            # If user exists and is not deleted, perform soft delete
            result = mongo.db.users.update_one(
                {"_id": ObjectId(user_id), "isDeleted": False},
                {
                    "$set": {
                        "isDeleted": True,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            
            if result.modified_count:
                return True, None
            
            return False, "Failed to delete user"
            
        except InvalidId:
            return False, "Invalid user ID format"
        except Exception as e:
            return False, f"Error occurred: {str(e)}"

    @staticmethod
    def restore_user(user_id: str) -> Tuple[Optional[User], Optional[str]]:
        try:
            # First check if user exists
            user = mongo.db.users.find_one({"_id": ObjectId(user_id)})
            if not user:
                return None, "User with this ID does not exist"
            
            # Then check if user is actually deleted
            if not user.get('isDeleted', False):
                return None, "User is not deleted"

            result = mongo.db.users.update_one(
                {"_id": ObjectId(user_id), "isDeleted": True},
                {
                    "$set": {
                        "isDeleted": False,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            
            if result.modified_count:
                return UserService.get_user_by_id(user_id)[0], None
                
            return None, "Failed to restore user"

        except InvalidId:
            return None, "Invalid user ID format"
        except Exception as e:
            return None, f"Error restoring user: {str(e)}"