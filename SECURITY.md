# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest (main) | ✅ |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Email: vasugupta9911@gmail.com  
Subject: `[NEURAMED SECURITY] <brief description>`

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

You will receive an acknowledgment within 48 hours. We aim to patch critical issues within 7 days.

## Security Controls

- JWT access tokens expire in 15 minutes; refresh tokens expire in 7 days
- Tokens are revoked server-side on logout (JTI blacklist)
- httpOnly cookies used for token storage where same-origin
- PBKDF2-SHA256 password hashing at 600,000 iterations (OWASP 2024)
- Rate limiting on all auth endpoints
- File upload type and size validation on all upload endpoints
- CORS restricted to explicit origin allowlist
- Security headers: X-Frame-Options, X-Content-Type-Options, HSTS (production)
- CodeQL scanning on every push to main
- Dependabot weekly dependency updates
