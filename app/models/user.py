from datetime import datetime
from bson import ObjectId
from dataclasses import dataclass, field
from typing import Optional, Dict, Any

@dataclass
class User:
    username: str
    email: str
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    _id: Optional[str] = None
    isDeleted: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "_id": ObjectId(self._id) if self._id else ObjectId(),
            "username": self.username,
            "email": self.email,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "isDeleted": self.isDeleted
        }
    
    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'User':
        return User(
            _id=str(data["_id"]),
            username=data["username"],
            email=data["email"],
            created_at=data.get("created_at", datetime.utcnow()),
            updated_at=data.get("updated_at", datetime.utcnow()),
            isDeleted=data.get("isDeleted", False)
        )

    def to_response_dict(self) -> Dict[str, Any]:
        return {
            "id": self._id,
            "username": self.username,
            "email": self.email,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "isDeleted": self.isDeleted
        }