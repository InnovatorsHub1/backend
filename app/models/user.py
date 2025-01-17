from bson import ObjectId
from typing import Optional, Dict, Any
from datetime import datetime
from dataclasses import dataclass, field


@dataclass
class User:
    """
    User model representing a user in the system.
    Uses dataclass for automatic __init__, __repr__, etc.
    """
    username: str
    email: str
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    _id: Optional[str] = None
    isDeleted: bool = False

    def to_dict(self) -> Dict[str, Any]:
        """
        Convert user instance to dictionary format for database storage.
        Handles ObjectId conversion and datetime formatting.
        
        Returns:
            Dict[str, Any]: Dictionary representation of user
        """
        return {
            "_id": ObjectId(self._id) if self._id else ObjectId(),
            "username": self.username,
            "email": self.email,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "isDeleted": self.isDeleted,
        }

    @staticmethod
    def _parse_datetime(value: Any) -> datetime:
        """
        Parse a value into a datetime object.
        If the value is already a datetime, return it.
        If it's a string, parse it as ISO 8601.
        
        Args:
            value: The value to parse.
        
        Returns:
            datetime: Parsed datetime object.
        """
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            return datetime.fromisoformat(value)
        raise ValueError(f"Cannot parse datetime from value: {value}")

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'User':
        """
        Create a User instance from a dictionary.
        Handles ObjectId conversion and datetime parsing.
        
        Args:
            data: Dictionary containing user data
            
        Returns:
            User: New User instance
        """
        return User(
            _id=str(data["_id"]),
            username=data["username"],
            email=data["email"],
            created_at=User._parse_datetime(data.get("created_at", datetime.utcnow())),
            updated_at=User._parse_datetime(data.get("updated_at", datetime.utcnow())),
            isDeleted=data.get("isDeleted", False),
        )

    def to_response_dict(self) -> Dict[str, Any]:
        """
        Convert user instance to dictionary format for API responses.
        Handles datetime formatting and excludes sensitive data.
        
        Returns:
            Dict[str, Any]: API-friendly dictionary representation
        """
        return {
            "id": self._id,
            "username": self.username,
            "email": self.email,
            "created_at": self.created_at.isoformat() if isinstance(self.created_at, datetime) else self.created_at,
            "updated_at": self.updated_at.isoformat() if isinstance(self.updated_at, datetime) else self.updated_at,
            "isDeleted": self.isDeleted,
        }

    def update(self, data: Dict[str, Any]) -> None:
        """
        Update user attributes from dictionary.
        Only updates provided fields.
        
        Args:
            data: Dictionary containing fields to update
        """
        for key, value in data.items():
            if key == "updated_at" and isinstance(value, str):
                value = User._parse_datetime(value)
            if hasattr(self, key) and key not in ["_id", "created_at"]:
                setattr(self, key, value)
        self.updated_at = datetime.utcnow()

    def validate(self) -> bool:
        """
        Validate user data.
        
        Returns:
            bool: True if valid, raises ValueError otherwise
            
        Raises:
            ValueError: If validation fails
        """
        if not self.username or len(self.username) < 3:
            raise ValueError("Username must be at least 3 characters long")

        if not self.email or "@" not in self.email:
            raise ValueError("Invalid email format")

        return True

    def __str__(self) -> str:
        """String representation of User"""
        return f"User(id={self._id}, username={self.username}, email={self.email})"