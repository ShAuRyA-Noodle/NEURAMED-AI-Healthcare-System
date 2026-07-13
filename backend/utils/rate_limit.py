"""H5 — lightweight in-memory rate limiting for auth endpoints.

Single-worker, best-effort. Disabled entirely under ENVIRONMENT=test so the
test suite (which bursts registrations/logins) is never throttled.
"""
import os
import time
from collections import defaultdict
from fastapi import Request, HTTPException

_WINDOW_SECONDS = 60
_MAX_ATTEMPTS = 10
_attempts: dict = defaultdict(list)


def _enforce(request: Request, max_attempts: int = _MAX_ATTEMPTS,
             window: int = _WINDOW_SECONDS) -> None:
    # Gate: only enforce outside the test environment.
    if os.getenv("ENVIRONMENT") == "test":
        return
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    recent = [t for t in _attempts[ip] if now - t < window]
    if len(recent) >= max_attempts:
        _attempts[ip] = recent
        raise HTTPException(
            status_code=429,
            detail="Too many attempts. Please try again later.",
        )
    recent.append(now)
    _attempts[ip] = recent


def auth_rate_limit(request: Request) -> None:
    """FastAPI dependency: throttle auth attempts per client IP."""
    _enforce(request)
