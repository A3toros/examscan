# Frontend Update Guide

## Overview

The authentication system has been updated to use HTTP-only cookies instead of client-side storage. This provides better security by preventing XSS attacks.

## Key Changes

### 1. Auth Utilities (`src/utils/auth.ts`)

**Before:** Used `document.cookie` to read/write tokens directly
**After:** Uses API endpoints with `credentials: 'include'` to work with HTTP-only cookies

**New Functions:**
- `getCurrentUser()` - Fetches current user from `/api/auth-me` (async)
- `isAuthenticated()` - Checks authentication (async)
- `isAdmin()` - Checks if user is admin (async)
- `loginWithPassword()` - Password login
- `sendOTP()` - Send OTP for login/signup/reset
- `verifyOTP()` - Verify OTP and complete auth
- `logout()` - Logout and clear sessions
- `resetPassword()` - Reset password with OTP
- `changePassword()` - Change password (authenticated)
- `authenticatedFetch()` - Helper for authenticated API calls

### 2. Dashboard Component

**Updated to:**
- Use `getCurrentUser()` instead of `getAuthCookies()`
- Use `authenticatedFetch()` for API calls
- Use `logout()` function instead of manual cookie clearing

## Migration Steps

### Step 1: Update Components Using Auth

Replace all instances of:
```typescript
// OLD
import { getAuthCookies, clearAuthCookies } from '../utils/auth';
const auth = getAuthCookies();
const token = auth?.token;
```

With:
```typescript
// NEW
import { getCurrentUser, authenticatedFetch, logout } from '../utils/auth';
const user = await getCurrentUser();
// Use authenticatedFetch() for API calls
```

### Step 2: Update API Calls

**Before:**
```typescript
fetch('/.netlify/functions/exams', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
```

**After:**
```typescript
import { authenticatedFetch } from '../utils/auth';

authenticatedFetch('/.netlify/functions/exams')
```

### Step 3: Update Authentication Checks

**Before:**
```typescript
const isAuth = isAuthenticated(); // synchronous
if (!isAuth) {
  navigate('/login');
}
```

**After:**
```typescript
const isAuth = await isAuthenticated(); // async
if (!isAuth) {
  navigate('/login');
}
```

## New Authentication Flows

### OTP Registration Flow

1. User enters email → `sendOTP(email, 'signup')`
2. User receives OTP via email
3. User enters OTP + user details → `verifyOTP(email, code, 'signup', { firstName, lastName, username, password })`
4. User is logged in automatically

### OTP Login Flow

1. User enters email → `sendOTP(email, 'login')`
2. User receives OTP via email
3. User enters OTP → `verifyOTP(email, code, 'login')`
4. User is logged in automatically

### Password Reset Flow

1. User enters email → `sendOTP(email, 'password_reset')`
2. User receives OTP via email
3. User enters OTP + new password → `resetPassword(email, code, newPassword)`
4. All sessions revoked, user must log in again

## Example: Protected Route Component

```typescript
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, type User } from '../utils/auth';

function ProtectedComponent() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        navigate('/login');
        return;
      }
      setUser(currentUser);
      setLoading(false);
    };
    checkAuth();
  }, [navigate]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return <div>Welcome, {user?.firstName}!</div>;
}
```

## Example: API Call with Authentication

```typescript
import { authenticatedFetch } from '../utils/auth';

async function loadData() {
  try {
    const response = await authenticatedFetch('/.netlify/functions/my-endpoint');
    if (response.ok) {
      const data = await response.json();
      return data;
    } else if (response.status === 401) {
      // Unauthorized - redirect to login
      navigate('/login');
    }
  } catch (error) {
    console.error('API error:', error);
  }
}
```

## Benefits of HTTP-only Cookies

1. **XSS Protection**: Cookies can't be accessed via JavaScript
2. **Automatic**: Cookies are sent automatically with requests
3. **Secure**: Server controls cookie security flags
4. **Session Management**: Server can revoke sessions

## Notes

- All auth functions are now **async** (use `await`)
- Cookies are set automatically by the server
- No need to manually manage tokens
- Use `credentials: 'include'` in all fetch calls (handled by `authenticatedFetch()`)
