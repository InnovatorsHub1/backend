from typing import Optional

class MockRedisClient:
    """Mock Redis client for testing"""
    
    def __init__(self):
        self.data = {}
        self._is_connected = True

    def ping(self):
        """Test connection"""
        return True

    def get(self, key: str) -> Optional[str]:
        """Get value from mock cache"""
        value = self.data.get(key)
        if value is None:
            return None
        return value

    def setex(self, key: str, time: int, value: str) -> bool:
        """Set value with expiration in mock cache"""
        self.data[key] = value
        return True

    def delete(self, *keys: str) -> int:
        """Delete keys from mock cache"""
        count = 0
        for key in keys:
            if key in self.data:
                del self.data[key]
                count += 1
        return count

    def scan(self, cursor: int = 0, match: str = None, count: int = None):
        """Scan keys in mock cache"""
        if match:
            # Convert Redis pattern to regex pattern
            pattern = match.replace("*", ".*")
            import re
            regex = re.compile(pattern)
            matched_keys = [k for k in self.data.keys() if regex.match(k)]
            return (0, matched_keys)
        return (0, list(self.data.keys()))

    def exists(self, key: str) -> bool:
        """Check if key exists in mock cache"""
        return key in self.data

    def flushdb(self) -> bool:
        """Clear all data in mock cache"""
        self.data.clear()
        return True

class MockRedis:
    """Mock Redis factory"""
    
    @staticmethod
    def from_url(*args, **kwargs) -> MockRedisClient:
        return MockRedisClient()