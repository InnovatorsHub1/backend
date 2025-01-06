from flask import Blueprint, jsonify, request
from app.services.user_service import UserService
from app.models.user import User

user_bp = Blueprint("users", __name__, url_prefix="/api/users")

@user_bp.route("/", methods=["POST"])
def create_user():
    data = request.get_json()
    user = UserService.create_user(data)
    return jsonify({"user": user.__dict__}), 201

@user_bp.route("/", methods=["GET"])
def get_users():
    users = UserService.get_all_users()
    return jsonify({"users": [user.__dict__ for user in users]}), 200

@user_bp.route("/<user_id>", methods=["GET"])
def get_user(user_id):
    user = UserService.get_user_by_id(user_id)
    return jsonify({"user": user.__dict__}), 200

@user_bp.route("/<user_id>", methods=["PUT"])
def update_user(user_id):
    data = request.get_json()
    user = UserService.update_user(user_id, data)
    return jsonify({"user": user.__dict__}), 200

@user_bp.route("/<user_id>", methods=["DELETE"])
def delete_user(user_id):
    UserService.delete_user(user_id)
    return "", 204