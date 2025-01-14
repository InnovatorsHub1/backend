from datetime import datetime


class MockQueueService:
    def __init__(self):
        self.jobs = {}
        self.next_job_id = 1

    def add_job(self, func: callable, *args, **kwargs) -> str:
        """Add job to queue"""
        job_id = str(self.next_job_id)
        self.next_job_id += 1

        # Initially set as queued
        self.jobs[job_id] = {
            "status": "queued",
            "result": None,
            "error": None,
            "enqueued_at": datetime.utcnow().isoformat(),
            "func": func,
            "args": args,
            "kwargs": kwargs
        }
        return job_id

    def get_job_status(self, job_id: str) -> dict:
        """Get job status"""
        if job_id not in self.jobs:
            return {"status": "not_found"}
        return self.jobs[job_id]

    def simulate_job_completion(self, job_id: str, success: bool = True):
        """Simulate job completion for testing"""
        if job_id in self.jobs:
            job = self.jobs[job_id]
            if success:
                try:
                    result = job["func"](*job["args"], **job["kwargs"])
                    job["status"] = "finished"
                    job["result"] = result
                except Exception as e:
                    job["status"] = "failed"
                    job["error"] = str(e)
            else:
                job["status"] = "failed"
                job["error"] = "Simulated failure"