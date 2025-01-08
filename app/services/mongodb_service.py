from typing import Dict, List, Any, Optional
from flask_pymongo import PyMongo
from pymongo.collection import Collection
from pymongo.results import InsertOneResult, UpdateResult, DeleteResult
from bson import ObjectId
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class MongoDBService:
    """
    MongoDB service implementation.
    Handles all MongoDB operations with proper error handling and logging.
    """

    def __init__(self, mongo: PyMongo, collection_name: str = 'users'):
        """
        Initialize MongoDB service.
        
        Args:
            mongo (PyMongo): Flask-PyMongo instance
            collection_name (str): Name of the collection to use
        """
        self.mongo = mongo
        self.collection_name = collection_name
        self._collection: Collection = self.mongo.db[collection_name]

    def _format_mongo_error(self, operation: str, error: Exception) -> str:
        """
        Format MongoDB error message.
        
        Args:
            operation (str): Operation that failed
            error (Exception): The exception that occurred
            
        Returns:
            str: Formatted error message
        """
        return f"MongoDB {operation} error in {self.collection_name}: {str(error)}"

    def find_one(self, query: Dict, projection: Dict = None) -> Optional[Dict]:
        """
        Find a single document.
        
        Args:
            query (Dict): Query parameters
            projection (Dict, optional): Fields to include/exclude
            
        Returns:
            Optional[Dict]: Found document or None
        """
        try:
            logger.debug(f"Finding one document in {self.collection_name} with query: {query}")
            result = self._collection.find_one(query, projection)
            
            if result:
                logger.debug(f"Found document in {self.collection_name}")
                return result
            
            logger.debug(f"No document found in {self.collection_name} for query: {query}")
            return None

        except Exception as e:
            error_msg = self._format_mongo_error("find_one", e)
            logger.error(error_msg)
            raise Exception(error_msg)

    def find(self, 
            query: Dict, 
            projection: Dict = None,
            sort: List = None,
            skip: int = 0,
            limit: int = 0
        ) -> List[Dict]:
        """
        Find multiple documents.
        
        Args:
            query (Dict): Query parameters
            projection (Dict, optional): Fields to include/exclude
            sort (List, optional): Sort criteria [(field, direction)]
            skip (int): Number of documents to skip
            limit (int): Maximum number of documents to return
            
        Returns:
            List[Dict]: List of found documents
        """
        try:
            logger.debug(
                f"Finding documents in {self.collection_name} with query: {query}, "
                f"sort: {sort}, skip: {skip}, limit: {limit}"
            )
            
            cursor = self._collection.find(query, projection)
            
            if sort:
                cursor = cursor.sort(sort)
            if skip:
                cursor = cursor.skip(skip)
            if limit:
                cursor = cursor.limit(limit)
            
            results = list(cursor)
            logger.debug(f"Found {len(results)} documents in {self.collection_name}")
            return results

        except Exception as e:
            error_msg = self._format_mongo_error("find", e)
            logger.error(error_msg)
            raise Exception(error_msg)

    def insert_one(self, document: Dict) -> str:
        """
        Insert a single document.
        
        Args:
            document (Dict): Document to insert
            
        Returns:
            str: ID of inserted document
        """
        try:
            # Add timestamps
            document['created_at'] = datetime.utcnow()
            document['updated_at'] = document['created_at']
            
            logger.debug(f"Inserting document in {self.collection_name}")
            result: InsertOneResult = self._collection.insert_one(document)
            
            if not result.acknowledged:
                raise Exception("Insert was not acknowledged by MongoDB")
                
            inserted_id = str(result.inserted_id)
            logger.debug(f"Successfully inserted document with ID: {inserted_id}")
            return inserted_id

        except Exception as e:
            error_msg = self._format_mongo_error("insert_one", e)
            logger.error(error_msg)
            raise Exception(error_msg)

    def update_one(self, 
                filter: Dict, 
                update: Dict, 
                upsert: bool = False
            ) -> UpdateResult:
        """
        Update a single document.
        
        Args:
            filter (Dict): Query to match document
            update (Dict): Update operations
            upsert (bool): Whether to insert if document doesn't exist
            
        Returns:
            UpdateResult: Result of update operation
        """
        try:
            # Add updated timestamp
            if '$set' in update:
                update['$set']['updated_at'] = datetime.utcnow()
            else:
                update['$set'] = {'updated_at': datetime.utcnow()}
                
            logger.debug(f"Updating document in {self.collection_name} with filter: {filter}")
            result: UpdateResult = self._collection.update_one(
                filter, 
                update,
                upsert=upsert
            )
            
            if not result.acknowledged:
                raise Exception("Update was not acknowledged by MongoDB")
                
            logger.debug(
                f"Update complete. Modified: {result.modified_count}, "
                f"Matched: {result.matched_count}, Upserted: {result.upserted_id is not None}"
            )
            return result

        except Exception as e:
            error_msg = self._format_mongo_error("update_one", e)
            logger.error(error_msg)
            raise Exception(error_msg)

    def update_many(self,
                 filter: Dict,
                 update: Dict,
                 upsert: bool = False
            ) -> UpdateResult:
        """
        Update multiple documents.
        
        Args:
            filter (Dict): Query to match documents
            update (Dict): Update operations
            upsert (bool): Whether to insert if documents don't exist
            
        Returns:
            UpdateResult: Result of update operation
        """
        try:
            # Add updated timestamp
            if '$set' in update:
                update['$set']['updated_at'] = datetime.utcnow()
            else:
                update['$set'] = {'updated_at': datetime.utcnow()}
                
            logger.debug(f"Updating documents in {self.collection_name} with filter: {filter}")
            result: UpdateResult = self._collection.update_many(
                filter,
                update,
                upsert=upsert
            )
            
            if not result.acknowledged:
                raise Exception("Update was not acknowledged by MongoDB")
                
            logger.debug(
                f"Update complete. Modified: {result.modified_count}, "
                f"Matched: {result.matched_count}"
            )
            return result

        except Exception as e:
            error_msg = self._format_mongo_error("update_many", e)
            logger.error(error_msg)
            raise Exception(error_msg)

    def delete_one(self, filter: Dict) -> DeleteResult:
        """
        Delete a single document.
        
        Args:
            filter (Dict): Query to match document
            
        Returns:
            DeleteResult: Result of delete operation
        """
        try:
            logger.debug(f"Deleting document in {self.collection_name} with filter: {filter}")
            result: DeleteResult = self._collection.delete_one(filter)
            
            if not result.acknowledged:
                raise Exception("Delete was not acknowledged by MongoDB")
                
            logger.debug(f"Delete complete. Deleted: {result.deleted_count}")
            return result

        except Exception as e:
            error_msg = self._format_mongo_error("delete_one", e)
            logger.error(error_msg)
            raise Exception(error_msg)

    def delete_many(self, filter: Dict) -> DeleteResult:
        """
        Delete multiple documents.
        
        Args:
            filter (Dict): Query to match documents
            
        Returns:
            DeleteResult: Result of delete operation
        """
        try:
            logger.debug(f"Deleting documents in {self.collection_name} with filter: {filter}")
            result: DeleteResult = self._collection.delete_many(filter)
            
            if not result.acknowledged:
                raise Exception("Delete was not acknowledged by MongoDB")
                
            logger.debug(f"Delete complete. Deleted: {result.deleted_count}")
            return result

        except Exception as e:
            error_msg = self._format_mongo_error("delete_many", e)
            logger.error(error_msg)
            raise Exception(error_msg)

    def count_documents(self, filter: Dict) -> int:
        """
        Count documents matching filter.
        
        Args:
            filter (Dict): Query to match documents
            
        Returns:
            int: Number of matching documents
        """
        try:
            logger.debug(f"Counting documents in {self.collection_name} with filter: {filter}")
            count = self._collection.count_documents(filter)
            logger.debug(f"Found {count} matching documents")
            return count

        except Exception as e:
            error_msg = self._format_mongo_error("count_documents", e)
            logger.error(error_msg)
            raise Exception(error_msg)

    def aggregate(self, pipeline: List[Dict]) -> List[Dict]:
        """
        Perform aggregation operation.
        
        Args:
            pipeline (List[Dict]): Aggregation pipeline stages
            
        Returns:
            List[Dict]: Aggregation results
        """
        try:
            logger.debug(f"Running aggregation in {self.collection_name}")
            results = list(self._collection.aggregate(pipeline))
            logger.debug(f"Aggregation complete. Got {len(results)} results")
            return results

        except Exception as e:
            error_msg = self._format_mongo_error("aggregate", e)
            logger.error(error_msg)
            raise Exception(error_msg)

    def create_index(self, keys: List[tuple], **kwargs) -> str:
        """
        Create an index.
        
        Args:
            keys (List[tuple]): List of (field, direction) pairs
            **kwargs: Additional index options
            
        Returns:
            str: Name of created index
        """
        try:
            logger.debug(f"Creating index in {self.collection_name} for keys: {keys}")
            index_name = self._collection.create_index(keys, **kwargs)
            logger.debug(f"Successfully created index: {index_name}")
            return index_name

        except Exception as e:
            error_msg = self._format_mongo_error("create_index", e)
            logger.error(error_msg)
            raise Exception(error_msg)

    def drop_index(self, index_name: str) -> None:
        """
        Drop an index.
        
        Args:
            index_name (str): Name of index to drop
        """
        try:
            logger.debug(f"Dropping index {index_name} in {self.collection_name}")
            self._collection.drop_index(index_name)
            logger.debug(f"Successfully dropped index: {index_name}")

        except Exception as e:
            error_msg = self._format_mongo_error("drop_index", e)
            logger.error(error_msg)
            raise Exception(error_msg)

    def get_collection_stats(self) -> Dict:
        """
        Get collection statistics.
        
        Returns:
            Dict: Collection statistics
        """
        try:
            logger.debug(f"Getting stats for collection {self.collection_name}")
            stats = self.mongo.db.command("collStats", self.collection_name)
            logger.debug(f"Successfully retrieved collection stats")
            return stats

        except Exception as e:
            error_msg = self._format_mongo_error("get_collection_stats", e)
            logger.error(error_msg)
            raise Exception(error_msg)