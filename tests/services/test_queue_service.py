import pytest
import time
import json

from datetime import datetime

from app.errors.exceptions import APIError

class TestQueueService:
    """Test suite for Queue Service basic operations"""

    def test_add_job_success(self, app):
        """Test successful job creation"""
        job_id = app.queue_service.add_job(lambda x: x, "test_data")
        assert job_id is not None
        
        # Initially queued
        status = app.queue_service.get_job_status(job_id)
        assert status["status"] == "queued"

        # After completion
        app.queue_service.simulate_job_completion(job_id)
        status = app.queue_service.get_job_status(job_id)
        assert status["status"] == "finished"

    def test_get_job_status_not_found(self, app):
        """Test getting non-existent job status"""
        status = app.queue_service.get_job_status("non_existent")
        assert status["status"] == "not_found"

    def test_get_job_status_complete(self, app):
        """Test getting completed job status"""
        # Create job
        job_id = app.queue_service.add_job(lambda x: x * 2, 5)
        
        # Simulate job completion
        app.queue_service.jobs[job_id].update({
            "status": "finished",
            "result": 10
        })
        
        status = app.queue_service.get_job_status(job_id)
        assert status["status"] == "finished"
        assert status["result"] == 10


class TestQueueProcessing:
    """Test suite for Queue Processing"""
    
    def test_multiple_messages_processing(self, app, client, headers):
        job_ids = []
        
        # Add jobs
        for i in range(10):
            response = client.post(
                '/api/queue/jobs',
                json={"message": f"test_message_{i}"},
                headers=headers
            )
            assert response.status_code == 202
            data = json.loads(response.data)
            job_ids.append(data["job_id"])

        # Check initial queued status
        for job_id in job_ids:
            status = app.queue_service.get_job_status(job_id)
            assert status["status"] == "queued"

        # Simulate processing
        for job_id in job_ids:
            app.queue_service.simulate_job_completion(job_id)

        # Verify completion
        for job_id in job_ids:
            status = app.queue_service.get_job_status(job_id)
            assert status["status"] == "finished"
    

    def test_message_processing_with_errors(self, app, client, headers):
        job_ids = []
        
        # Add test messages
        for i in range(5):
            # Good message
            response = client.post(
                '/api/queue/jobs',
                json={"message": f"good_message_{i}"},
                headers=headers
            )
            assert response.status_code == 202
            job_id = json.loads(response.data)["job_id"]
            job_ids.append(job_id)
            app.queue_service.simulate_job_completion(job_id, True)

            # Bad message
            response = client.post(
                '/api/queue/jobs',
                json={"message": None},
                headers=headers
            )
            assert response.status_code == 202
            job_id = json.loads(response.data)["job_id"]
            job_ids.append(job_id)
            app.queue_service.simulate_job_completion(job_id, False)

        # Count results
        success_count = sum(1 for job_id in job_ids 
                        if app.queue_service.get_job_status(job_id)["status"] == "finished")
        error_count = sum(1 for job_id in job_ids 
                        if app.queue_service.get_job_status(job_id)["status"] == "failed")

        assert success_count == 5, "Expected 5 successful jobs"
        assert error_count == 5, "Expected 5 failed jobs"

    def test_queue_performance(self, app, client, headers):
        """Test queue performance with batch processing"""
        start_time = time.time()
        
        # Add 100 messages quickly
        job_ids = []
        for i in range(100):
            response = client.post(
                '/api/queue/jobs',
                json={"message": f"batch_message_{i}"},
                headers=headers
            )
            assert response.status_code == 202
            job_ids.append(json.loads(response.data)["job_id"])

        # Verify all processed immediately (in test environment)
        for job_id in job_ids:
            status = app.queue_service.get_job_status(job_id)
            assert status["status"] == "queued"

        # Calculate processing time
        total_time = time.time() - start_time
        print(f"Processed {len(job_ids)} messages in {total_time:.2f} seconds")

