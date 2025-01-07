from flask import Blueprint, jsonify, request
from app.services.user_service import UserService
from app.errors.exceptions import APIError

user_bp = Blueprint("users", __name__, url_prefix="/api/users")

@user_bp.route("/", methods=["POST"])
def create_user():
    try:
        data = request.get_json()
        if not data:
            raise APIError("No input data provided", 400)

        user = UserService.create_user(data)
        return jsonify({"user": user.to_response_dict()}), 201

    except APIError:
        raise
    except Exception as e:
        raise APIError(str(e), 500)

@user_bp.route("/", methods=["GET"])
def get_users():
    try:
        include_deleted = request.args.get('include_deleted', '').lower() == 'true'
        users = UserService.get_all_users(include_deleted)
        return jsonify({
            "users": [user.to_response_dict() for user in users]
        }), 200

    except APIError:
        raise
    except Exception as e:
        raise APIError(str(e), 500)

@user_bp.route("/<user_id>", methods=["GET"])
def get_user(user_id):
    try:
        include_deleted = request.args.get('include_deleted', '').lower() == 'true'
        user = UserService.get_user_by_id(user_id, include_deleted)
        return jsonify({"user": user.to_response_dict()}), 200

    except APIError:
        raise
    except Exception as e:
        raise APIError(str(e), 500)

@user_bp.route("/<user_id>", methods=["PUT"])
def update_user(user_id):
    try:
        data = request.get_json()
        if not data:
            raise APIError("No input data provided", 400)

        user = UserService.update_user(user_id, data)
        return jsonify({"user": user.to_response_dict()}), 200

    except APIError:
        raise
    except Exception as e:
        raise APIError(str(e), 500)

@user_bp.route("/<user_id>", methods=["DELETE"])
def delete_user(user_id):
    try:
        UserService.delete_user(user_id)
        return "", 204

    except APIError:
        raise
    except Exception as e:
        raise APIError(str(e), 500)

@user_bp.route("/<user_id>/restore", methods=["POST"])
def restore_user(user_id):
    try:
        user = UserService.restore_user(user_id)
        return jsonify({"user": user.to_response_dict()}), 200

    except APIError:
        raise
    except Exception as e:
        raise APIError(str(e), 500)
