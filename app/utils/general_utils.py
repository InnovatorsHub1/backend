import re

def validate_email(email: str) -> bool:
    """
    Validate email format.

    Args:
        email: Email address to validate

    Returns:
        bool: True if valid, False otherwise
    """
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))