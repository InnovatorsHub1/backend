from flask import Flask
from flask_cors import CORS
from flask_pymongo import PyMongo
from app.config import Config
from app.utils.error_handlers import register_error_handlers
from app.utils.logger import setup_logger, RequestLoggingMiddleware
from app.services.mongodb_service import MongoDBService
from app.services.redis_cache_service import RedisCacheService
from app.services.user_service import UserService

mongo = PyMongo()

def initialize_services(app, db_service=None, cache_service=None):
    if not db_service:
        db_service = MongoDBService(mongo)
    if not cache_service:
        cache_service = RedisCacheService(app.config["REDIS_URL"])
    app.user_service = UserService(db_service, cache_service)

def create_app(test_config=None):
    app = Flask(__name__)

    # Configure app
    if test_config:
        app.config.update(test_config)
    else:
        app.config.from_object(Config)

    # Enable CORS
    CORS(app, origins=app.config["CORS_ORIGINS"])

    # Initialize MongoDB
    mongo.init_app(app)

    # Initialize services
    initialize_services(app)

    # Setup logging
    access_logger = setup_logger(app)
    app.wsgi_app = RequestLoggingMiddleware(app.wsgi_app, access_logger)

    # Register error handlers
    register_error_handlers(app)


    # Register blueprints
    from app.routes.user_routes import user_bp
    app.register_blueprint(user_bp)

    return app