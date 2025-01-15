import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

def process_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """Example task processor"""
    try:
        logger.info(f"Processing data: {data}")
        # Your processing logic here
        result = {
            "processed": True,
            "input": data,
            "result": "Task completed successfully"
        }
        logger.info("Data processing completed")
        return result
    except Exception as e:
        logger.error(f"Data processing failed: {str(e)}")
        raise