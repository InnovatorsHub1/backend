import pytest
import json

from datetime import datetime
from app.errors.exceptions import APIError

class TestQueueRoutes:
    def test_create_job_success(self, client, headers):
        response = client.post(
            '/api/queue/jobs',
            json={"data": "test"},
            headers=headers
        )
        assert response.status_code == 202
        data = json.loads(response.data)
        assert "job_id" in data
        assert data["status"] == "queued"


    def test_invalid_job_data(self, client, headers):
        response = client.post(
            '/api/queue/jobs',
            json=None,
            headers=headers
        )
        assert response.status_code == 400

        response = client.post(
            '/api/queue/jobs',
            json={},
            headers=headers
        )
        assert response.status_code == 400

        response = client.post(
            '/api/queue/jobs',
            data="invalid json",
            headers=headers
        )
        assert response.status_code == 400

    def test_job_status_invalid_id(self, client, headers):
        response = client.get(
            '/api/queue/jobs/invalid_id',
            headers=headers
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["status"] == "not_found"