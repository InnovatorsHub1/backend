import os

class Config:
    MONGO_URI = os.environ.get(
        "MONGO_URI",
        f"mongodb://{os.environ.get('MONGO_USERNAME')}:{os.environ.get('MONGO_PASSWORD')}@mongodb:27017/{os.environ.get('MONGO_DB')}?authSource=admin"
    )
    REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")
    CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*")