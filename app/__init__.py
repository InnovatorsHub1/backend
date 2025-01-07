from flask import Flask
from flask_pymongo import PyMongo
from flask_cors import CORS
from os import environ
from app.utils.error_handlers import register_error_handlers
from app.utils.logger import setup_logger, RequestLoggingMiddleware

mongo = PyMongo()

from app.routes.user_routes import user_bp

def create_app():
    app = Flask(__name__)
    CORS(app)
    

    app.config["MONGO_URI"] = environ.get(
        "MONGO_URI",
        f"mongodb://{environ.get('MONGO_USERNAME')}:{environ.get('MONGO_PASSWORD')}@mongodb:27017/{environ.get('MONGO_DB')}?authSource=admin"
    )
    
    mongo.init_app(app)
    
    access_logger = setup_logger(app)
    
    app.wsgi_app = RequestLoggingMiddleware(app.wsgi_app, access_logger)
    
    register_error_handlers(app)

    app.register_blueprint(user_bp)
    
    return app