# Testing Guide

## Pre-Testing Setup

### 1. Database Migration
```sql
-- Execute database/schema_updates.sql in your Neon database
-- This creates:
--   - otp_verifications table
--   - user_sessions table
--   - Updates users table with new columns
```

### 2. Environment Variables
Set up in Netlify or `.env` file:
```bash
NEON_DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
RESEND_API_KEY=re_...
FROM_EMAIL=noreply@examscan.org
UPSTASH_REDIS_REST_URL=https://... (optional)
UPSTASH_REDIS_REST_TOKEN=... (optional)
COOKIE_DOMAIN=localhost
NODE_ENV=development
```

### 3. Start Development Server
```bash
npm run netlify:dev
# or
npm run dev
```

## Test Cases

### 1. OTP Registration Flow

**Test Steps:**
1. Navigate to `/register`
2. Enter email address
3. Click "Send Verification Code"
4. Check email for 6-digit code
5. Enter OTP code
6. Fill in user details (first name, last name, username, password)
7. Submit form

**Expected Results:**
- ✅ OTP sent successfully
- ✅ Email received with 6-digit code
- ✅ OTP verification succeeds
- ✅ Account created
- ✅ User logged in automatically
- ✅ Redirected to dashboard
- ✅ HTTP-only cookies set

**Edge Cases to Test:**
- Invalid email format
- Email already registered
- Invalid OTP code
- Expired OTP (wait 5+ minutes)
- Too many OTP attempts (enter wrong code 5 times)
- Resend OTP functionality

### 2. Password Login Flow

**Test Steps:**
1. Navigate to `/login`
2. Select "Password" tab
3. Enter username/email and password
4. Click "Sign In"

**Expected Results:**
- ✅ Login successful
- ✅ HTTP-only cookies set
- ✅ Redirected to dashboard
- ✅ User data displayed correctly

**Edge Cases to Test:**
- Invalid username/email
- Wrong password
- Rate limiting (10 failed attempts)
- Account doesn't exist

### 3. OTP Login Flow

**Test Steps:**
1. Navigate to `/login`
2. Select "OTP Code" tab
3. Enter email address
4. Click "Send Verification Code"
5. Enter OTP from email
6. Click "Verify Code"

**Expected Results:**
- ✅ OTP sent successfully
- ✅ Email received
- ✅ OTP verification succeeds
- ✅ User logged in
- ✅ Redirected to dashboard

**Edge Cases to Test:**
- Email not registered
- Invalid OTP
- Expired OTP
- Resend functionality

### 4. Password Reset Flow

**Test Steps:**
1. Navigate to `/forgot-password`
2. Enter email address
3. Click "Send Reset Code"
4. Enter OTP from email
5. Enter new password
6. Confirm new password
7. Submit

**Expected Results:**
- ✅ Reset code sent
- ✅ OTP verified
- ✅ Password reset successfully
- ✅ All sessions revoked
- ✅ Redirected to login
- ✅ Can login with new password

**Edge Cases to Test:**
- Email not found
- Invalid OTP
- Password too short
- Passwords don't match

### 5. Session Management

**Test Steps:**
1. Login successfully
2. Check browser DevTools → Application → Cookies
3. Verify cookies are HTTP-only
4. Verify cookies have Secure flag (in production)
5. Verify SameSite attribute
6. Logout
7. Verify cookies cleared

**Expected Results:**
- ✅ `access_token` cookie set (24h expiry)
- ✅ `session_token` cookie set (7d expiry)
- ✅ Cookies are HTTP-only
- ✅ Cookies cleared on logout
- ✅ Cannot access cookies via JavaScript

### 6. Rate Limiting

**Test Steps:**
1. Attempt 11 failed logins in quick succession
2. Check for rate limit error
3. Wait 15 minutes or check reset time
4. Try again

**Expected Results:**
- ✅ Rate limit triggered after 10 attempts
- ✅ Error message shows retry time
- ✅ Rate limit headers in response
- ✅ Can retry after cooldown period

### 7. OTP Security

**Test Steps:**
1. Request OTP
2. Check database for OTP
3. Verify OTP is hashed (not plaintext)
4. Try to verify with wrong OTP multiple times
5. Check attempt counter increments

**Expected Results:**
- ✅ OTP stored as hash in database
- ✅ Salt stored separately
- ✅ Cannot see plaintext OTP in database
- ✅ Attempt counter increments
- ✅ OTP invalidated after max attempts

### 8. JWT Token Validation

**Test Steps:**
1. Login successfully
2. Make authenticated API call
3. Verify token in request
4. Try with invalid/expired token
5. Check session revocation

**Expected Results:**
- ✅ Valid token allows access
- ✅ Invalid token returns 401
- ✅ Expired token returns 401
- ✅ Revoked session returns 401

### 9. CORS and Security Headers

**Test Steps:**
1. Make API request from browser
2. Check response headers in DevTools
3. Verify CORS headers
4. Verify security headers

**Expected Results:**
- ✅ `Access-Control-Allow-Origin` set correctly
- ✅ `Access-Control-Allow-Credentials: true`
- ✅ `X-Content-Type-Options: nosniff`
- ✅ `X-Frame-Options: DENY`
- ✅ `X-XSS-Protection: 1; mode=block`
- ✅ `Strict-Transport-Security` header

### 10. Input Sanitization

**Test Steps:**
1. Try to submit forms with:
   - XSS attempts: `<script>alert('xss')</script>`
   - SQL injection: `'; DROP TABLE users; --`
   - Special characters
   - Very long strings
   - Control characters

**Expected Results:**
- ✅ XSS attempts sanitized
- ✅ SQL injection prevented
- ✅ Input length limited
- ✅ Control characters removed
- ✅ Special characters handled safely

## Manual Testing Checklist

### Registration
- [ ] Email validation works
- [ ] OTP sent successfully
- [ ] OTP email received
- [ ] OTP verification works
- [ ] Invalid OTP rejected
- [ ] Expired OTP rejected
- [ ] Resend OTP works
- [ ] User details validation
- [ ] Account creation succeeds
- [ ] Auto-login after registration
- [ ] Redirect to dashboard

### Login (Password)
- [ ] Username/email login works
- [ ] Password validation
- [ ] Invalid credentials rejected
- [ ] Rate limiting works
- [ ] Cookies set correctly
- [ ] Redirect to dashboard

### Login (OTP)
- [ ] Email validation
- [ ] OTP sent successfully
- [ ] OTP verification works
- [ ] Invalid OTP rejected
- [ ] Resend works
- [ ] Cookies set correctly
- [ ] Redirect to dashboard

### Password Reset
- [ ] Email validation
- [ ] Reset code sent
- [ ] OTP verification works
- [ ] Password validation
- [ ] Password reset succeeds
- [ ] Sessions revoked
- [ ] Can login with new password

### Session Management
- [ ] Cookies are HTTP-only
- [ ] Cookies have correct expiry
- [ ] Logout clears cookies
- [ ] Logout revokes sessions
- [ ] Multiple sessions limited (max 3)
- [ ] Session revocation works

### Security
- [ ] Rate limiting active
- [ ] OTP hashing works
- [ ] Input sanitization works
- [ ] CORS headers correct
- [ ] Security headers present
- [ ] XSS protection works

## Automated Testing (Future)

### Unit Tests
```typescript
// Test OTP generation
test('OTP is 6 digits', () => {
  const otp = generateOTP();
  expect(otp).toMatch(/^\d{6}$/);
});

// Test OTP hashing
test('OTP is hashed correctly', () => {
  const { code, hash, salt } = generateOTPWithHash();
  expect(verifyOTP(code, hash, salt)).toBe(true);
});

// Test input sanitization
test('Email is sanitized', () => {
  const email = '  TEST@EXAMPLE.COM  ';
  expect(sanitizeEmail(email)).toBe('test@example.com');
});
```

### Integration Tests
```typescript
// Test registration flow
test('Complete registration flow', async () => {
  // 1. Send OTP
  const sendResponse = await sendOTP('test@example.com', 'signup');
  expect(sendResponse.success).toBe(true);
  
  // 2. Verify OTP (mock)
  // 3. Create account
  // 4. Verify login
});
```

### E2E Tests (Playwright)
```typescript
test('User can register with OTP', async ({ page }) => {
  await page.goto('/register');
  await page.fill('[name="email"]', 'test@example.com');
  await page.click('button:has-text("Send Verification Code")');
  // Wait for OTP email (or mock)
  await page.fill('[name="otp"]', '123456');
  // Complete registration...
});
```

## Common Issues & Solutions

### Issue: OTP not received
**Solution:**
- Check RESEND_API_KEY is set
- Check FROM_EMAIL is verified in Resend
- Check spam folder
- Verify email service logs

### Issue: Rate limiting not working
**Solution:**
- Check UPSTASH_REDIS_REST_URL and TOKEN are set
- Verify Redis connection
- Check rate limit logs

### Issue: Cookies not set
**Solution:**
- Verify credentials: 'include' in fetch calls
- Check CORS configuration
- Verify COOKIE_DOMAIN setting
- Check browser console for errors

### Issue: JWT validation fails
**Solution:**
- Verify JWT_SECRET is set
- Check token format
- Verify token hasn't expired
- Check session revocation status

## Performance Testing

### Load Testing
- Test with multiple concurrent registrations
- Test rate limiting under load
- Test session cleanup performance
- Test database query performance

### Security Testing
- Test brute force protection
- Test SQL injection attempts
- Test XSS attempts
- Test CSRF protection
- Test session hijacking prevention

## Browser Compatibility

Test in:
- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari
- ✅ Mobile browsers

## Production Checklist

Before deploying:
- [ ] All environment variables set
- [ ] Database migration run
- [ ] Rate limiting configured
- [ ] Email service configured
- [ ] CORS origins updated
- [ ] Cookie domain set correctly
- [ ] NODE_ENV=production
- [ ] HTTPS enabled
- [ ] Security headers verified
- [ ] Error logging configured
