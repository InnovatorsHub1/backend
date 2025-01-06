from flask import Flask
from flask_pymongo import PyMongo
from flask_cors import CORS
from os import environ

mongo = PyMongo()

# Import user_bp outside the function
from app.routes.user_routes import user_bp

def create_app():
    app = Flask(__name__)
    CORS(app)  # Simple CORS setup
    app.config["MONGO_URI"] = environ.get(
        "MONGO_URI",
        f"mongodb://{environ.get('MONGO_USERNAME')}:{environ.get('MONGO_PASSWORD')}@mongodb:27017/{environ.get('MONGO_DB')}?authSource=admin"
    )
    
    mongo.init_app(app)
    
    # Register the blueprint
    app.register_blueprint(user_bp)
    
    return app