import redis
from rq import Queue
from typing import Any, Optional
import logging

logger = logging.getLogger(__name__)

class QueueService:
    """Service for managing job queues using Redis Queue"""
    
    def __init__(self, redis_url: str):
        try:
            self.redis_conn = redis.from_url(redis_url)
            self.queue = Queue(connection=self.redis_conn)
            logger.info("Queue service initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize queue service: {str(e)}")
            raise
    
    def add_job(self, func: callable, *args, **kwargs) -> str:
        """Add job to queue"""
        try:
            job = self.queue.enqueue(func, *args, **kwargs)
            logger.info(f"Job added successfully: {job.id}")
            return job.id
        except Exception as e:
            logger.error(f"Failed to add job: {str(e)}")
            raise
            
    def get_job_status(self, job_id: str) -> dict:
        """Get job status"""
        try:
            job = self.queue.fetch_job(job_id)
            if not job:
                return {"status": "not_found"}
                
            return {
                "id": job.id,
                "status": job.get_status(),
                "result": job.result,
                "error": str(job.exc_info) if job.exc_info else None,
                "enqueued_at": job.enqueued_at.isoformat() if job.enqueued_at else None
            }
        except Exception as e:
            logger.error(f"Failed to get job status: {str(e)}")
            raise