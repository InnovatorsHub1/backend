from flask import Flask
from flask_cors import CORS
from flask_pymongo import PyMongo

from app.config import Config
from app.utils.error_handlers import register_error_handlers
from app.utils.logger import setup_logger, RequestLoggingMiddleware
from app.utils.json_encoder import MongoJSONEncoder

from app.services.mongodb_service import MongoDBService
from app.services.redis_cache_service import RedisCacheService
from app.services.user_service import UserService
from app.services.health_service import HealthService
from app.services.queue_service import QueueService
from app.services.pdf_service import PDFService
from app.services.file_service import FileService


from app.routes.user_routes import user_bp
from app.routes.health_routes import health_bp
from app.routes.queue_routes import queue_bp
from app.routes.pdf_routes import pdf_bp 
from app.routes.file_routes import file_bp

mongo = PyMongo()

def initialize_services(app, db_service=None, cache_service=None, queue_service=None):
    """Initialize application services"""
    if not db_service:
        db_service = MongoDBService(mongo)
    if not cache_service:
        cache_service = RedisCacheService(app.config["REDIS_URL"])
    if not queue_service:
        queue_service = QueueService(app.config["REDIS_URL"])
    
    app.user_service = UserService(db_service, cache_service)
    app.health_service = HealthService(app, db_service, cache_service)
    app.queue_service = queue_service
    app.pdf_service = PDFService()
    app.file_service = FileService(MongoDBService(mongo, 'files'))


def create_app(test_config=None):
    app = Flask(__name__)

    # Add custom JSON encoder
    app.json = MongoJSONEncoder(app)

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
    app.register_blueprint(user_bp)
    app.register_blueprint(health_bp)
    app.register_blueprint(queue_bp)
    app.register_blueprint(pdf_bp)
    app.register_blueprint(file_bp)

    return app