# Environment Variables

This document lists all required and optional environment variables for the ExamScan project.

## Required Variables

### Database
```bash
NEON_DATABASE_URL=postgresql://user:password@host/database
```
- PostgreSQL connection string for Neon database
- Used for all database operations

### JWT Authentication
```bash
JWT_SECRET=your-super-secret-jwt-key-change-in-production
```
- Secret key for signing and verifying JWT tokens
- **IMPORTANT**: Use a strong, random secret in production
- Generate with: `openssl rand -base64 32`

### Email Service (Resend)
```bash
RESEND_API_KEY=re_xxxxxxxxxxxxx
FROM_EMAIL=noreply@examscan.org
```
- Resend API key for sending emails
- From email address (must be verified in Resend)

## Optional Variables

### Rate Limiting (Upstash Redis)
```bash
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token
```
- Upstash Redis REST API URL and token
- Used for rate limiting
- If not set, rate limiting will be disabled (requests allowed)

### Cookies
```bash
COOKIE_DOMAIN=examscan.org
```
- Domain for HTTP-only cookies
- Leave unset or set to `localhost` for local development
- Required for production deployments

### Environment
```bash
NODE_ENV=production|development
```
- Environment mode
- Affects cookie security settings (Secure flag, SameSite)
- Defaults to development if not set

### Frontend URL
```bash
FRONTEND_URL=https://examscan.org
```
- Frontend application URL
- Used in email templates and CORS configuration

## Netlify Environment Variables

To set environment variables in Netlify:

1. Go to your site dashboard
2. Navigate to **Site settings** → **Environment variables**
3. Add each variable with its value
4. For production, set `NODE_ENV=production`

## Local Development

Create a `.env` file in the project root:

```bash
# Database
NEON_DATABASE_URL=postgresql://...

# JWT
JWT_SECRET=your-dev-secret-key

# Email
RESEND_API_KEY=re_...
FROM_EMAIL=noreply@examscan.org

# Rate Limiting (optional for dev)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Cookies
COOKIE_DOMAIN=localhost
NODE_ENV=development
```

## Security Notes

1. **Never commit `.env` files** to version control
2. **Use different secrets** for development and production
3. **Rotate JWT_SECRET** if compromised
4. **Keep RESEND_API_KEY** secure (allows sending emails)
5. **Use strong passwords** for database connections

## Testing Without Upstash

If you don't want to set up Upstash Redis for development:
- Leave `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` unset
- Rate limiting will be disabled (all requests allowed)
- This is fine for local development but **not recommended for production**
