from flask import Blueprint, jsonify, request, current_app
from app.errors.exceptions import APIError
from app.tasks.task_processor import process_data
import logging

logger = logging.getLogger(__name__)
queue_bp = Blueprint("queue", __name__, url_prefix="/api/queue")

@queue_bp.route("/jobs", methods=["POST"])
def create_job():
    try:
        if not request.is_json:
            raise APIError("Invalid Content-Type, must be application/json", 400)

        data = request.get_json()
        if not data:
            raise APIError("No input data provided", 400)
        
        job_id = current_app.queue_service.add_job(
            process_data,
            data
        )
        
        return jsonify({
            "job_id": job_id,
            "status": "queued"
        }), 202
        
    except APIError:
        raise
    except Exception as e:
        logger.error(f"Error creating job: {str(e)}")
        raise APIError("Invalid request data", 400)

@queue_bp.route("/jobs/<job_id>", methods=["GET"])
def get_job_status(job_id):
    try:
        status = current_app.queue_service.get_job_status(job_id)
        return jsonify(status), 200
    except Exception as e:
        raise APIError(str(e), 500)