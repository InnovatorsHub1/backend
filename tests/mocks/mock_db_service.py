from datetime import datetime, timezone
from bson import ObjectId
from typing import Dict, List, Any, Optional


class MockDBService:
    """Mock database service for testing"""
    
    def __init__(self):
        self.data = {}

    def find_one(self, query: Dict, projection: Dict = None) -> Optional[Dict]:
        """Find one document in mock DB"""
        # Handle ObjectId conversion
        if '_id' in query and isinstance(query['_id'], ObjectId):
            query['_id'] = str(query['_id'])

        # Handle simple exact matches
        for doc in self.data.values():
            matches = all(
                key in doc and doc[key] == value
                for key, value in query.items()
            )
            if matches:
                return doc.copy()
        return None

    def find(self, query: Dict, projection: Dict = None, sort: List = None) -> List[Dict]:
        """Find documents in mock DB"""
        # Filter documents based on query
        results = []
        for doc in self.data.values():
            matches = all(
                key in doc and doc[key] == value
                for key, value in query.items()
            )
            if matches:
                results.append(doc.copy())

        # Apply sorting if specified
        if sort:
            for field, direction in reversed(sort):
                results.sort(
                    key=lambda x: x.get(field),
                    reverse=(direction == -1)
                )

        return results

    def insert_one(self, document: Dict) -> str:
        """Insert one document in mock DB"""
        _id = str(ObjectId())
        document['_id'] = _id
        document.setdefault('created_at', datetime.now(timezone.utc))
        document.setdefault('updated_at', datetime.now(timezone.utc))
        self.data[_id] = document.copy()
        return _id

    def update_one(self, filter: Dict, update: Dict, upsert: bool = False) -> Any:
        """Update one document in mock DB"""
        # Convert ObjectId
        if '_id' in filter and isinstance(filter['_id'], ObjectId):
            filter['_id'] = str(filter['_id'])

        # Find matching document
        doc_id = None
        for _id, doc in self.data.items():
            matches = all(
                key in doc and doc[key] == value
                for key, value in filter.items()
            )
            if matches:
                doc_id = _id
                break

        if doc_id:
            # Update document
            if '$set' in update:
                self.data[doc_id].update(update['$set'])
            self.data[doc_id]['updated_at'] = datetime.now(timezone.utc)
            return type('UpdateResult', (), {'modified_count': 1})()
        elif upsert:
            # Insert new document
            new_id = self.insert_one({**filter, **update.get('$set', {})})
            return type('UpdateResult', (), {
                'modified_count': 0,
                'upserted_id': new_id
            })()
        return type('UpdateResult', (), {'modified_count': 0})()

    def count_documents(self, filter: Dict) -> int:
        """Count documents in mock DB"""
        return len(self.find(filter))