import base64

def bytes_to_b64(file_bytes: bytes) -> str:
    """Helper to convert bytes to base64 string for JSON responses."""
    return base64.b64encode(file_bytes).decode('utf-8')
