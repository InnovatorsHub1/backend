import logging

from flask import Blueprint, jsonify, current_app

from app.errors.exceptions import APIError


logger = logging.getLogger(__name__)
health_bp = Blueprint("health", __name__, url_prefix="/health")

@health_bp.route("/", methods=["GET"])
def get_health():
    """Get basic health status"""
    try:
        status = current_app.health_service.get_health_status()
        return jsonify(status), 200 if status["status"] == "healthy" else 503
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise APIError("Health check failed", 500)

@health_bp.route("/detailed", methods=["GET"])
def get_detailed_health():
    """Get detailed health metrics"""
    try:
        health_service = current_app.health_service
        
        return jsonify({
            "health": health_service.get_health_status(),
            "system_metrics": health_service.get_system_metrics(),
            "application_metrics": health_service.get_application_metrics()
        }), 200
    except Exception as e:
        logger.error(f"Detailed health check failed: {str(e)}")
        raise APIError("Detailed health check failed", 500)

@health_bp.route("/metrics", methods=["GET"])
def get_metrics():
    """Get application metrics for monitoring"""
    try:
        metrics = current_app.health_service.get_application_metrics()
        return jsonify(metrics), 200
    except Exception as e:
        logger.error(f"Metrics collection failed: {str(e)}")
        raise APIError("Metrics collection failed", 500)