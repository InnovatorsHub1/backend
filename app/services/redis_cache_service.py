import json
import logging
import redis 

from typing import Any, Optional
from datetime import datetime, timedelta


logger = logging.getLogger(__name__)


class RedisCacheService:
    """
    Redis cache service implementation.
    Handles all Redis operations with proper error handling and logging.
    """

    def __init__(self, redis_url: str):
        """
        Initialize Redis connection.
        
        Args:
            redis_url (str): Redis connection URL (e.g., "redis://localhost:6379/0")
        """
        self._redis_client = self._initialize_redis_client(redis_url)

    @staticmethod
    def _initialize_redis_client(redis_url: str) -> Optional[redis.Redis]:
        """
        Initialize and test the Redis client.
        
        Args:
            redis_url (str): Redis connection URL
        
        Returns:
            redis.Redis: Redis client instance or None if initialization fails
        """
        try:
            client = redis.from_url(
                redis_url,
                decode_responses=True,
                socket_timeout=2,
                retry_on_timeout=True,
                max_connections=10,
            )
            client.ping()
            logger.info("Successfully connected to Redis")
            return client
        except redis.ConnectionError as e:
            logger.error(f"Failed to connect to Redis: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error connecting to Redis: {str(e)}")
        return None

    @staticmethod
    def _serialize(value: Any) -> str:
        """
        Serialize value to JSON string.
        
        Args:
            value: Any JSON-serializable value
            
        Returns:
            str: JSON string representation of the value
        """
        def default_serializer(obj):
            if isinstance(obj, datetime):
                return obj.isoformat()
            raise TypeError(f"Type {type(obj)} not serializable")

        try:
            return json.dumps(value, default=default_serializer)
        except (TypeError, ValueError) as e:
            logger.error(f"Serialization error: {str(e)}")
            raise ValueError(f"Could not serialize value: {str(e)}")

    @staticmethod
    def _deserialize(value: Optional[str]) -> Any:
        """
        Deserialize JSON string to Python object.
        
        Args:
            value (str): JSON string to deserialize
            
        Returns:
            Any: Deserialized Python object
        """
        if value is None:
            return None

        try:
            return json.loads(value)
        except json.JSONDecodeError as e:
            logger.error(f"Deserialization error: {str(e)}")
            raise ValueError(f"Could not deserialize value: {str(e)}")

    def _is_client_initialized(self) -> bool:
        """
        Check if the Redis client is initialized.
        
        Returns:
            bool: True if initialized, False otherwise
        """
        if not self._redis_client:
            logger.warning("Redis client not initialized")
            return False
        return True

    def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache.
        
        Args:
            key (str): Cache key
            
        Returns:
            Any: Cached value if found, None otherwise
        """
        if not self._is_client_initialized():
            return None

        try:
            data = self._redis_client.get(key)
            if data is not None:
                logger.debug(f"Cache hit for key: {key}")
                return self._deserialize(data)
            logger.debug(f"Cache miss for key: {key}")
            return None
        except Exception as e:
            logger.error(f"Error getting key {key} from Redis: {str(e)}")
            return None

    def set(self, key: str, value: Any, expire: int = 3600) -> bool:
        """
        Set value in cache with expiration.
        
        Args:
            key (str): Cache key
            value (Any): Value to cache (must be JSON serializable)
            expire (int): Expiration time in seconds (default: 1 hour)
            
        Returns:
            bool: True if successful, False otherwise
        """
        if not self._is_client_initialized():
            return False

        try:
            serialized_value = self._serialize(value)
            self._redis_client.setex(key, timedelta(seconds=expire), serialized_value)
            logger.debug(f"Successfully set cache for key: {key}")
            return True
        except Exception as e:
            logger.error(f"Error setting key {key} in Redis: {str(e)}")
            return False

    def delete(self, key: str) -> bool:
        """
        Delete value from cache.
        
        Args:
            key (str): Cache key to delete
            
        Returns:
            bool: True if successful, False otherwise
        """
        if not self._is_client_initialized():
            return False

        try:
            self._redis_client.delete(key)
            logger.debug(f"Successfully deleted cache for key: {key}")
            return True
        except Exception as e:
            logger.error(f"Error deleting key {key} from Redis: {str(e)}")
            return False

    def delete_pattern(self, pattern: str) -> bool:
        """
        Delete all keys matching pattern.
        
        Args:
            pattern (str): Pattern to match (e.g., "user:*")
            
        Returns:
            bool: True if successful, False otherwise
        """
        if not self._is_client_initialized():
            return False

        try:
            cursor = 0
            while True:
                cursor, keys = self._redis_client.scan(cursor, match=pattern, count=100)
                if keys:
                    self._redis_client.delete(*keys)
                if cursor == 0:
                    break
            logger.debug(f"Successfully deleted cache for pattern: {pattern}")
            return True
        except Exception as e:
            logger.error(f"Error deleting pattern {pattern} from Redis: {str(e)}")
            return False

    def exists(self, key: str) -> bool:
        """
        Check if key exists in cache.
        
        Args:
            key (str): Cache key to check
            
        Returns:
            bool: True if key exists, False otherwise
        """
        if not self._is_client_initialized():
            return False

        try:
            return bool(self._redis_client.exists(key))
        except Exception as e:
            logger.error(f"Error checking key {key} in Redis: {str(e)}")
            return False

    def clear_all(self) -> bool:
        """
        Clear all cache entries (use with caution).
        
        Returns:
            bool: True if successful, False otherwise
        """
        if not self._is_client_initialized():
            return False

        try:
            self._redis_client.flushdb()
            logger.warning("Cleared all cache entries")
            return True
        except Exception as e:
            logger.error(f"Error clearing cache: {str(e)}")
            return False