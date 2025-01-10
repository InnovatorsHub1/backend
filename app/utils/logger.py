import logging
import logging.handlers
import os
from datetime import datetime
from flask import request, has_request_context
from typing import Optional

class RequestFormatter(logging.Formatter):
    """Custom formatter that includes request information"""
    
    def format(self, record):
        if has_request_context():
            record.url = request.url
            record.remote_addr = request.remote_addr
            record.method = request.method
            record.request_id = request.headers.get('X-Request-ID', '-')
        else:
            record.url = None
            record.remote_addr = None
            record.method = None
            record.request_id = None
            
        return super().format(record)

def setup_logger(app):
    """Configure application logging"""
    
    # Create logs directory if it doesn't exist
    if not os.path.exists('logs'):
        os.makedirs('logs')
        
    # Define log formats
    request_formatter = RequestFormatter(
        '[%(asctime)s] %(remote_addr)s - Request_ID:%(request_id)s '
        '%(method)s %(url)s %(levelname)s: %(message)s'
    )
    
    standard_formatter = logging.Formatter(
        '[%(asctime)s] %(levelname)s in %(module)s: %(message)s'
    )
    
    # Configure file handlers
    info_handler = logging.handlers.RotatingFileHandler(
        'logs/info.log',
        maxBytes=10000000,  # 10MB
        backupCount=5
    )
    info_handler.setLevel(logging.INFO)
    info_handler.setFormatter(request_formatter)
    
    error_handler = logging.handlers.RotatingFileHandler(
        'logs/error.log',
        maxBytes=10000000,  # 10MB
        backupCount=5
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(request_formatter)
    
    # Access log handler
    access_handler = logging.handlers.RotatingFileHandler(
        'logs/access.log',
        maxBytes=10000000,  # 10MB
        backupCount=5
    )
    access_handler.setLevel(logging.INFO)
    access_handler.setFormatter(request_formatter)
    
    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.DEBUG)
    console_handler.setFormatter(standard_formatter)
    
    # Set up the application logger
    app.logger.setLevel(logging.DEBUG)
    app.logger.addHandler(info_handler)
    app.logger.addHandler(error_handler)
    app.logger.addHandler(console_handler)
    
    # Create a separate access logger
    access_logger = logging.getLogger('access_logger')
    access_logger.setLevel(logging.INFO)
    access_logger.addHandler(access_handler)
    
    return access_logger

# Request logging middleware
class RequestLoggingMiddleware:
    def __init__(self, app, access_logger):
        self.app = app
        self.access_logger = access_logger
        
    def __call__(self, environ, start_response):
        path = environ.get('PATH_INFO')
        start_time = datetime.utcnow()
        
        def logging_start_response(status, headers, *args):
            end_time = datetime.utcnow()
            duration = (end_time - start_time).total_seconds()
            
            status_code = int(status.split()[0])
            self.access_logger.info(
                f'Path: {path} - Status: {status_code} - Duration: {duration:.3f}s'
            )
            
            return start_response(status, headers, *args)
        
        return self.app(environ, logging_start_response)