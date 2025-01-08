from typing import List, Dict, Any, Protocol
from datetime import datetime
import logging
from app.utils.general_utils import validate_email
from bson import ObjectId
from bson.errors import InvalidId

from app.models.user import User
from app.errors.exceptions import APIError

logger = logging.getLogger(__name__)

class CacheService(Protocol):
    """Protocol defining required cache operations"""
    def get(self, key: str) -> Any: ...
    def set(self, key: str, value: Any, expire: int) -> bool: ...
    def delete(self, key: str) -> bool: ...
    def delete_pattern(self, pattern: str) -> bool: ...

class DatabaseService(Protocol):
    """Protocol defining required database operations"""
    def find_one(self, query: Dict, projection: Dict = None) -> Dict: ...
    def find(self, query: Dict, projection: Dict = None, sort: List = None) -> List[Dict]: ...
    def insert_one(self, document: Dict) -> str: ...
    def update_one(self, filter: Dict, update: Dict, upsert: bool = False) -> Any: ...
    def delete_one(self, filter: Dict) -> Any: ...
    def count_documents(self, filter: Dict) -> int: ...

class UserService:
    """
    Service for managing user operations with caching support.
    Coordinates between database and cache operations.
    """
    
    CACHE_PREFIX = "user:"
    CACHE_TIMEOUT = 3600  # 1 hour in seconds

    def __init__(self, db_service: DatabaseService, cache_service: CacheService):
        """
        Initialize UserService with required dependencies.
        
        Args:
            db_service: Database service for persistent storage
            cache_service: Cache service for temporary storage
        """
        self.db = db_service
        self.cache = cache_service

    def _get_user_cache_key(self, user_id: str) -> str:
        """Generate cache key for a specific user"""
        return f"{self.CACHE_PREFIX}{user_id}"

    def _get_all_users_cache_key(self, include_deleted: bool) -> str:
        """Generate cache key for the users list"""
        return f"{self.CACHE_PREFIX}all:{'with_deleted' if include_deleted else 'active'}"

    def _invalidate_user_cache(self, user_id: str) -> None:
        """Invalidate cache for a specific user and all users list"""
        self.cache.delete(self._get_user_cache_key(user_id))
        self.cache.delete_pattern(f"{self.CACHE_PREFIX}all:*")


    def validate_user_data(self, data: Dict[str, Any], is_update: bool = False) -> None:
        """
        Validate user data for creation or update.
        
        Args:
            data: User data to validate
            is_update: Whether this is an update operation
            
        Raises:
            APIError: If validation fails
        """
        if not is_update:
            required_fields = ["username", "email"]
            if not all(field in data for field in required_fields):
                logger.warning("Validation failed: Missing required fields")
                raise APIError("Missing required fields: username and email", 400)

        if "email" in data and not validate_email(data["email"]):
            logger.warning(f"Validation failed: Invalid email format - {data.get('email')}")
            raise APIError("Invalid email format", 400)

        if "username" in data and (not isinstance(data["username"], str) or len(data["username"]) < 3):
            logger.warning(f"Validation failed: Invalid username format - {data.get('username')}")
            raise APIError("Username must be a string with at least 3 characters", 400)

    def create_user(self, user_data: Dict[str, Any]) -> User:
        """
        Create a new user.
        
        Args:
            user_data: User data for creation
            
        Returns:
            User: Created user object
            
        Raises:
            APIError: If creation fails
        """
        try:
            logger.info(f"Attempting to create user with email: {user_data.get('email')}")
            
            # Validate input data
            self.validate_user_data(user_data)

            # Check if user exists
            if self.db.find_one({"email": user_data["email"], "isDeleted": False}):
                logger.warning(f"User creation failed: Email already exists - {user_data.get('email')}")
                raise APIError("Email already exists", 400)
            
            # Create user
            user = User(**user_data)
            user_dict = user.to_dict()
            user_id = self.db.insert_one(user_dict)
            user._id = user_id
            
            # Invalidate cache
            self.cache.delete_pattern(f"{self.CACHE_PREFIX}all:*")
            
            logger.info(f"Successfully created user with ID: {user._id}")
            return user

        except APIError:
            raise
        except Exception as e:
            logger.error(f"Error creating user: {str(e)}", exc_info=True)
            raise APIError(f"Error creating user: {str(e)}", 500)

    def get_all_users(self, include_deleted: bool = False) -> List[User]:
        """
        Get all users with optional cache.
        
        Args:
            include_deleted: Whether to include deleted users
            
        Returns:
            List[User]: List of user objects
            
        Raises:
            APIError: If retrieval fails
        """
        try:
            logger.info(f"Fetching all users (include_deleted={include_deleted})")
            
            # Try cache first
            cache_key = self._get_all_users_cache_key(include_deleted)
            cached_users = self.cache.get(cache_key)
            
            if cached_users:
                logger.debug("Cache hit for all users list")
                return [User.from_dict(user_dict) for user_dict in cached_users]
            
            # Get from database
            query = {} if include_deleted else {"isDeleted": False}
            users = list(self.db.find(query))
            
            # Prepare for cache
            users_for_cache = []
            for user in users:
                user_dict = dict(user)
                user_dict['_id'] = str(user_dict['_id'])
                users_for_cache.append(user_dict)
            
            # Cache results
            self.cache.set(cache_key, users_for_cache, self.CACHE_TIMEOUT)
            
            user_list = [User.from_dict(user) for user in users]
            logger.info(f"Successfully retrieved {len(user_list)} users")
            return user_list
            
        except Exception as e:
            logger.error(f"Error fetching users: {str(e)}", exc_info=True)
            raise APIError(f"Error fetching users: {str(e)}", 500)

    def get_user_by_id(self, user_id: str, include_deleted: bool = False) -> User:
        """
        Get a specific user by ID with cache support.
        
        Args:
            user_id: User ID to fetch
            include_deleted: Whether to include deleted users
            
        Returns:
            User: User object
            
        Raises:
            APIError: If user not found or retrieval fails
        """
        try:
            logger.info(f"Fetching user with ID: {user_id}")
            
            # Try cache first
            cache_key = self._get_user_cache_key(user_id)
            cached_user = self.cache.get(cache_key)
            
            if cached_user:
                logger.debug(f"Cache hit for user: {user_id}")
                return User.from_dict(cached_user)
            
            # Get from database
            query = {"_id": ObjectId(user_id)}
            if not include_deleted:
                query["isDeleted"] = False
                
            user = self.db.find_one(query)
            if not user:
                logger.warning(f"User not found with ID: {user_id}")
                raise APIError("User not found", 404)
            
            # Cache result
            user_dict = dict(user)
            user_dict['_id'] = str(user_dict['_id'])
            self.cache.set(cache_key, user_dict, self.CACHE_TIMEOUT)
            
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

    def update_user(self, user_id: str, user_data: Dict[str, Any]) -> User:
        """
        Update a user with cache invalidation.
        
        Args:
            user_id: User ID to update
            user_data: Updated user data
            
        Returns:
            User: Updated user object
            
        Raises:
            APIError: If update fails
        """
        try:
            logger.info(f"Attempting to update user with ID: {user_id}")
            
            # Validate input
            self.validate_user_data(user_data, is_update=True)

            # Check if user exists
            current_user = self.get_user_by_id(user_id)

            # Check email uniqueness
            if "email" in user_data and user_data["email"] != current_user.email:
                logger.debug(f"Checking email uniqueness for: {user_data['email']}")
                if self.db.find_one({
                    "email": user_data["email"], 
                    "_id": {"$ne": ObjectId(user_id)},
                    "isDeleted": False
                }):
                    logger.warning(f"Update failed: Email already exists - {user_data['email']}")
                    raise APIError("Email already exists", 400)

            # Update user
            user_data["updated_at"] = datetime.utcnow()
            result = self.db.update_one(
                {"_id": ObjectId(user_id), "isDeleted": False},
                {"$set": user_data}
            )
            
            if not result.modified_count:
                logger.error(f"Failed to update user: {user_id}")
                raise APIError("Failed to update user", 400)

            # Invalidate cache
            self._invalidate_user_cache(user_id)

            updated_user = self.get_user_by_id(user_id)
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

    def delete_user(self, user_id: str) -> None:
        """
        Soft delete a user and invalidate cache.
        
        Args:
            user_id: User ID to delete
            
        Raises:
            APIError: If deletion fails
        """
        try:
            logger.info(f"Attempting to delete user with ID: {user_id}")
            
            # Check if user exists
            user = self.db.find_one({"_id": ObjectId(user_id)})
            if not user:
                logger.warning(f"Delete failed: User not found with ID: {user_id}")
                raise APIError("User with this ID does not exist", 404)
            
            # Check if already deleted
            if user.get('isDeleted', False):
                logger.warning(f"Delete failed: User already deleted: {user_id}")
                raise APIError("User is already deleted", 400)

            # Perform soft delete
            result = self.db.update_one(
                {"_id": ObjectId(user_id), "isDeleted": False},
                {
                    "$set": {
                        "isDeleted": True,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            
            if not result.modified_count:
                logger.error(f"Failed to delete user: {user_id}")
                raise APIError("Failed to delete user", 400)

            # Invalidate cache
            self._invalidate_user_cache(user_id)
            
            logger.info(f"Successfully deleted user: {user_id}")

        except InvalidId:
            logger.error(f"Invalid user ID format: {user_id}")
            raise APIError("Invalid user ID format", 400)
        except APIError:
            raise
        except Exception as e:
            logger.error(f"Error deleting user: {str(e)}", exc_info=True)
            raise APIError(f"Error deleting user: {str(e)}", 500)
        
    def restore_user(self, user_id: str) -> User:
        """
        Restore a deleted user and invalidate cache.
        
        Args:
            user_id: User ID to restore
            
        Returns:
            User: Restored user object
            
        Raises:
            APIError: If restoration fails
        """
        try:
            logger.info(f"Attempting to restore user with ID: {user_id}")
            
            # Check if user exists
            user = self.db.find_one({"_id": ObjectId(user_id)})
            if not user:
                logger.warning(f"Restore failed: User not found with ID: {user_id}")
                raise APIError("User with this ID does not exist", 404)
            
            # Check if actually deleted
            if not user.get('isDeleted', False):
                logger.warning(f"Restore failed: User is not deleted: {user_id}")
                raise APIError("User is not deleted", 400)

            # Restore user
            result = self.db.update_one(
                {"_id": ObjectId(user_id), "isDeleted": True},
                {
                    "$set": {
                        "isDeleted": False,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            
            if not result.modified_count:
                logger.error(f"Failed to restore user: {user_id}")
                raise APIError("Failed to restore user", 400)

            # Invalidate cache
            self._invalidate_user_cache(user_id)

            restored_user = self.get_user_by_id(user_id, include_deleted=True)
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
        
