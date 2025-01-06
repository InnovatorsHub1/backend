from flask import Blueprint, jsonify, request
from app.services.user_service import UserService

user_bp = Blueprint("users", __name__, url_prefix="/api/users")

@user_bp.route("/", methods=["POST"])
def create_user():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No input data provided"}), 400

        user, error = UserService.create_user(data)
        if error:
            return jsonify({"error": error}), 400

        return jsonify({"user": user.to_response_dict()}), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@user_bp.route("/", methods=["GET"])
def get_users():
    try:
        include_deleted = request.args.get('include_deleted', '').lower() == 'true'
        users, error = UserService.get_all_users(include_deleted)
        
        if error:
            return jsonify({"error": error}), 500

        return jsonify({
            "users": [user.to_response_dict() for user in users]
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@user_bp.route("/<user_id>", methods=["GET"])
def get_user(user_id):
    try:
        include_deleted = request.args.get('include_deleted', '').lower() == 'true'
        user, error = UserService.get_user_by_id(user_id, include_deleted)
        
        if error:
            error_code = 404 if error == "User not found" else 400
            return jsonify({"error": error}), error_code

        return jsonify({"user": user.to_response_dict()}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@user_bp.route("/<user_id>", methods=["PUT"])
def update_user(user_id):
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No input data provided"}), 400

        user, error = UserService.update_user(user_id, data)
        if error:
            error_code = 404 if error == "User not found" else 400
            return jsonify({"error": error}), error_code

        return jsonify({"user": user.to_response_dict()}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@user_bp.route("/<user_id>", methods=["DELETE"])
def delete_user(user_id):
    try:
        success, error = UserService.delete_user(user_id)
        if error:
            error_code = 404 if "does not exist" in error else 400
            return jsonify({"error": error}), error_code

        return "", 204

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@user_bp.route("/<user_id>/restore", methods=["POST"])
def restore_user(user_id):
    try:
        user, error = UserService.restore_user(user_id)
        if error:
            error_code = 404 if "does not exist" in error else 400
            return jsonify({"error": error}), error_code

        return jsonify({"user": user.to_response_dict()}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
