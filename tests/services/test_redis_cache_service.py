import pytest

from datetime import datetime
from app.services.redis_cache_service import RedisCacheService

class TestRedisCacheService:
    """Test suite for RedisCacheService"""

    def test_set_and_get_simple(self, app):
        """Test basic set and get operations with simple values"""
        cache = app.user_service.cache
        
        # Test with string
        assert cache.set("test_key", "test_value") is True
        assert cache.get("test_key") == "test_value"

        # Test with None value
        assert cache.get("non_existent_key") is None

    def test_set_and_get_dict(self, app):
        """Test set and get with dictionary values"""
        cache = app.user_service.cache
        
        test_dict = {
            "name": "test",
            "value": 123,
            "nested": {"key": "value"}
        }
        assert cache.set("test_dict", test_dict) is True
        result = cache.get("test_dict")
        assert result == test_dict

    def test_set_and_get_list(self, app):
        """Test set and get with list values"""
        cache = app.user_service.cache
        
        test_list = [1, 2, 3, {"test": "value"}]
        assert cache.set("test_list", test_list) is True
        assert cache.get("test_list") == test_list

    def test_delete_single(self, app):
        """Test deleting a single key"""
        cache = app.user_service.cache

        # Set and verify value exists
        cache.set("delete_key", "delete_value")
        assert cache.get("delete_key") == "delete_value"

        # Delete and verify it's gone
        assert cache.delete("delete_key") is True
        assert cache.get("delete_key") is None

    def test_delete_pattern(self, app):
        """Test pattern-based deletion"""
        cache = app.user_service.cache

        # Set multiple keys with a pattern
        cache.set("user:1", "value1")
        cache.set("user:2", "value2")
        cache.set("other:1", "other_value")

        # Delete by pattern
        assert cache.delete_pattern("user:*") is True

        # Verify correct keys were deleted
        assert cache.get("user:1") is None
        assert cache.get("user:2") is None
        assert cache.get("other:1") == "other_value"

    def test_complex_objects(self, app):
        """Test handling complex nested objects"""
        cache = app.user_service.cache

        complex_obj = {
            "string": "value",
            "number": 123,
            "list": [1, 2, 3],
            "dict": {"key": "value"},
            "nested": {
                "list": [{"key": "value"}],
                "dict": {"nested": {"key": "value"}}
            }
        }

        assert cache.set("complex", complex_obj) is True
        result = cache.get("complex")
        assert result == complex_obj

    def test_datetime_handling(self, app):
        """Test handling datetime objects"""
        cache = app.user_service.cache
        
        now = datetime.now()
        data = {
            "date": now.isoformat(),
            "nested": {"date": now.isoformat()}
        }
        
        assert cache.set("date_test", data) is True
        result = cache.get("date_test")
        assert result == data

    def test_large_dataset(self, app):
        """Test handling large datasets"""
        cache = app.user_service.cache
        
        # Create large dataset
        large_data = {
            "items": [
                {
                    "id": i,
                    "data": "x" * 1000,
                    "nested": {"value": "y" * 100}
                }
                for i in range(100)
            ]
        }
        
        assert cache.set("large_data", large_data) is True
        result = cache.get("large_data")
        assert result == large_data
        assert len(result["items"]) == 100

    def test_special_characters(self, app):
        """Test handling special characters in keys and values"""
        cache = app.user_service.cache
        
        special_chars = {
            "key:with:colons": "value1",
            "key with spaces": "value2",
            "key_with_unicode_🔑": "value3",
            "normal_key": "value with spaces and 特殊文字"
        }

        for key, value in special_chars.items():
            assert cache.set(key, value) is True
            assert cache.get(key) == value

    def test_error_handling(self, app):
        """Test error handling scenarios"""
        cache = app.user_service.cache

        # Test with non-serializable object
        class TestObject:
            pass

        # Should handle error gracefully
        obj = TestObject()
        assert cache.set("bad_value", obj) is False
        assert cache.get("bad_value") is None

    def test_null_values(self, app):
        """Test handling of null/None values"""
        cache = app.user_service.cache

        # None value
        assert cache.set("null_key", None) is True
        assert cache.get("null_key") is None

        # Empty string
        assert cache.set("empty_string", "") is True
        assert cache.get("empty_string") == ""

        # Empty collections
        assert cache.set("empty_dict", {}) is True
        assert cache.get("empty_dict") == {}
        
        assert cache.set("empty_list", []) is True
        assert cache.get("empty_list") == []

    def test_expiration(self, app):
        """Test expiration handling"""
        cache = app.user_service.cache

        # Set with expiration
        assert cache.set("expire_key", "value", expire=1) is True
        assert cache.get("expire_key") == "value"

    def test_cache_isolation(self, app):
        """Test cache isolation between tests"""
        cache = app.user_service.cache

        # Set some data
        cache.set("test_key", "test_value")
        assert cache.get("test_key") == "test_value"

        # Clear cache
        cache._redis_client.flushdb()
        assert cache.get("test_key") is None

    def test_concurrent_operations(self, app):
        """Test multiple operations in sequence"""
        cache = app.user_service.cache

        # Set multiple keys
        for i in range(10):
            assert cache.set(f"key{i}", f"value{i}") is True

        # Get multiple keys
        for i in range(10):
            assert cache.get(f"key{i}") == f"value{i}"

        # Update multiple keys
        for i in range(10):
            assert cache.set(f"key{i}", f"new_value{i}") is True

        # Delete multiple keys
        for i in range(10):
            assert cache.delete(f"key{i}") is True
            assert cache.get(f"key{i}") is None

    def test_pattern_matching(self, app):
        """Test pattern matching functionality"""
        cache = app.user_service.cache

        # Set up test data
        patterns = {
            "user:1:profile": "data1",
            "user:1:settings": "data2",
            "user:2:profile": "data3",
            "other:data": "data4"
        }

        for key, value in patterns.items():
            cache.set(key, value)

        # Test different pattern deletions
        assert cache.delete_pattern("user:1:*") is True
        assert cache.get("user:1:profile") is None
        assert cache.get("user:1:settings") is None
        assert cache.get("user:2:profile") == "data3"
        assert cache.get("other:data") == "data4"