# API Endpoints Reference

## Authentication Endpoints

### Send OTP
- **Endpoint**: `POST /.netlify/functions/send-otp`
- **Body**: 
  ```json
  {
    "email": "user@example.com",
    "type": "signup" | "login" | "password_reset"
  }
  ```
- **Response**: 
  ```json
  {
    "success": true,
    "message": "OTP sent successfully"
  }
  ```
- **Rate Limit**: 10 attempts per 15 minutes

### Verify OTP
- **Endpoint**: `POST /.netlify/functions/verify-otp`
- **Body** (for signup):
  ```json
  {
    "email": "user@example.com",
    "code": "123456",
    "type": "signup",
    "firstName": "John",
    "lastName": "Doe",
    "username": "johndoe",
    "password": "password123"
  }
  ```
- **Body** (for login):
  ```json
  {
    "email": "user@example.com",
    "code": "123456",
    "type": "login"
  }
  ```
- **Body** (for password_reset):
  ```json
  {
    "email": "user@example.com",
    "code": "123456",
    "type": "password_reset"
  }
  ```
- **Response**: 
  ```json
  {
    "success": true,
    "message": "Account created successfully",
    "user": { ... },
    "token": "jwt_token",
    "sessionToken": "session_token"
  }
  ```
- **Cookies**: Sets `access_token`, `session_token`, and optionally `admin_token`

### Login (Password)
- **Endpoint**: `POST /.netlify/functions/login`
- **Body**: 
  ```json
  {
    "username": "user@example.com" | "username",
    "password": "password123"
  }
  ```
- **Response**: 
  ```json
  {
    "success": true,
    "message": "Login successful",
    "user": { ... },
    "token": "jwt_token",
    "sessionToken": "session_token"
  }
  ```
- **Rate Limit**: 10 failed attempts per 15 minutes
- **Cookies**: Sets `access_token`, `session_token`, and optionally `admin_token`

### Logout
- **Endpoint**: `POST /.netlify/functions/logout`
- **Body**: None (uses cookies)
- **Response**: 
  ```json
  {
    "success": true,
    "message": "Logged out successfully"
  }
  ```
- **Cookies**: Clears all auth cookies

### Get Current User
- **Endpoint**: `GET /.netlify/functions/auth-me`
- **Headers**: Cookies (automatic) or `Authorization: Bearer <token>`
- **Response**: 
  ```json
  {
    "success": true,
    "user": {
      "id": 1,
      "email": "user@example.com",
      "username": "johndoe",
      "firstName": "John",
      "lastName": "Doe",
      "role": "user",
      "createdAt": "2024-01-01T00:00:00Z",
      "lastLogin": "2024-01-01T00:00:00Z",
      "emailVerified": true
    }
  }
  ```

### Reset Password
- **Endpoint**: `POST /.netlify/functions/auth-reset-password`
- **Body**: 
  ```json
  {
    "email": "user@example.com",
    "code": "123456",
    "newPassword": "newpassword123"
  }
  ```
- **Response**: 
  ```json
  {
    "success": true,
    "message": "Password reset successfully. Please log in with your new password."
  }
  ```
- **Rate Limit**: 10 attempts per 15 minutes

### Change Password
- **Endpoint**: `POST /.netlify/functions/auth-change-password`
- **Headers**: Cookies (automatic) or `Authorization: Bearer <token>`
- **Body**: 
  ```json
  {
    "currentPassword": "oldpassword123",
    "newPassword": "newpassword123"
  }
  ```
- **Response**: 
  ```json
  {
    "success": true,
    "message": "Password changed successfully. Please log in with your new password."
  }
  ```

## Protected Endpoints

### Get Exams
- **Endpoint**: `GET /.netlify/functions/exams`
- **Headers**: Cookies (automatic) or `Authorization: Bearer <token>`
- **Response**: 
  ```json
  {
    "exams": [
      {
        "id": 1,
        "exam_name": "Math Test",
        "description": "...",
        "questions": [...],
        "created_at": "2024-01-01T00:00:00Z",
        "status": "draft",
        "total_scans": 0
      }
    ]
  }
  ```

### Create Exam
- **Endpoint**: `POST /.netlify/functions/exams`
- **Headers**: Cookies (automatic) or `Authorization: Bearer <token>`
- **Body**: 
  ```json
  {
    "name": "Math Test",
    "description": "Test description",
    "testStructure": [
      { "type": "mc", "count": 10 },
      { "type": "tf", "count": 5 }
    ],
    "answerKey": {
      "1": "A",
      "2": "T",
      "3": "B"
    },
    "studentInfo": {
      "name": true,
      "last_name": true,
      "nickname": false,
      "class": true
    }
  }
  ```

## Error Responses

### Rate Limited (429)
```json
{
  "success": false,
  "error": "Too many attempts. Please try again in X minutes.",
  "rateLimited": true,
  "retryAfter": 900,
  "resetTime": "2024-01-01T00:15:00Z"
}
```

### Invalid OTP (400)
```json
{
  "success": false,
  "error": "Invalid OTP. X attempts remaining."
}
```

### Unauthorized (401)
```json
{
  "success": false,
  "error": "Authentication required"
}
```

### Validation Error (400)
```json
{
  "success": false,
  "error": "Email is required"
}
```

## Frontend Usage

All endpoints are accessible via:
- Direct: `/.netlify/functions/<function-name>`
- Via redirect: `/api/<function-name>` (configured in netlify.toml)

The frontend `auth.ts` utility uses `/.netlify/functions/` as the base URL.

## Cookie Details

### access_token
- **Type**: JWT
- **Expiry**: 24 hours
- **HttpOnly**: Yes
- **Secure**: Yes (production)
- **SameSite**: Strict (production), Lax (development)

### session_token
- **Type**: JWT
- **Expiry**: 7 days
- **HttpOnly**: Yes
- **Secure**: Yes (production)
- **SameSite**: Strict (production), Lax (development)

### admin_token
- **Type**: JWT
- **Expiry**: 8 hours
- **HttpOnly**: Yes
- **Secure**: Yes (production)
- **SameSite**: Strict (production), Lax (development)
- **Only set for**: Admin users
