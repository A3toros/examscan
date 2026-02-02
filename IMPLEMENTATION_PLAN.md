# TypeScript + Node.js Implementation Plan
## Registration & Security System

This document outlines the implementation plan for building a TypeScript + Node.js backend with the same registration and security features as the Example project.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Database Schema](#database-schema)
5. [Core Features Implementation](#core-features-implementation)
6. [Security Features](#security-features)
7. [API Endpoints](#api-endpoints)
8. [Implementation Steps](#implementation-steps)
9. [Dependencies](#dependencies)
10. [Environment Variables](#environment-variables)
11. [Testing Strategy](#testing-strategy)

---

## Project Overview

### Goal
Build a production-ready TypeScript + Node.js backend API that implements:
- ✅ OTP-based registration system
- ✅ OTP-based login system
- ✅ Password-based login system
- ✅ Password reset with OTP
- ✅ JWT-based session management
- ✅ Rate limiting (Upstash Redis)
- ✅ Input sanitization and validation
- ✅ CORS and security headers
- ✅ Email service (Resend)
- ✅ Admin authentication

### Framework Choice
**Recommended: Express.js with TypeScript**
- Most popular and well-documented
- Large ecosystem
- Easy middleware integration
- Good TypeScript support

**Alternative: Fastify**
- Faster performance
- Built-in validation
- TypeScript support

---

## Technology Stack

### Core
- **Runtime**: Node.js 18+ (LTS)
- **Language**: TypeScript 5.0+
- **Framework**: Express.js 4.18+
- **Database**: PostgreSQL (Neon serverless or standard PostgreSQL)
- **ORM/Query Builder**: 
  - Option 1: `pg` (PostgreSQL client) - matches Example project
  - Option 2: `drizzle-orm` - modern TypeScript ORM
  - Option 3: `prisma` - full-featured ORM

### Authentication & Security
- **JWT**: `jsonwebtoken` 9.0+
- **Password Hashing**: `bcryptjs` 2.4+
- **OTP Hashing**: Node.js built-in `crypto` module
- **Rate Limiting**: `@upstash/redis` 1.36+
- **CORS**: `cors` middleware or custom implementation

### Email Service
- **Resend**: `resend` 4.0+

### Development Tools
- **Type Checking**: TypeScript compiler
- **Linting**: ESLint
- **Formatting**: Prettier
- **Testing**: Jest + Supertest
- **Environment**: `dotenv`

---

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── database.ts          # Database connection
│   │   ├── redis.ts             # Redis/Upstash client
│   │   └── env.ts               # Environment variables validation
│   │
│   ├── middleware/
│   │   ├── auth.ts              # JWT authentication middleware
│   │   ├── admin.ts             # Admin authorization middleware
│   │   ├── rateLimit.ts         # Rate limiting middleware
│   │   ├── cors.ts              # CORS configuration
│   │   ├── security.ts          # Security headers
│   │   └── validation.ts       # Input validation middleware
│   │
│   ├── utils/
│   │   ├── sanitize.ts          # Input sanitization utilities
│   │   ├── otp.ts               # OTP generation and verification
│   │   ├── password.ts           # Password hashing utilities
│   │   ├── jwt.ts                # JWT token utilities
│   │   └── clientId.ts           # Client identification (IP extraction)
│   │
│   ├── services/
│   │   ├── email.service.ts      # Email sending (Resend)
│   │   ├── otp.service.ts       # OTP management
│   │   ├── session.service.ts    # Session management
│   │   └── rateLimit.service.ts  # Rate limiting service
│   │
│   ├── controllers/
│   │   ├── auth.controller.ts    # Authentication endpoints
│   │   └── admin.controller.ts   # Admin endpoints
│   │
│   ├── routes/
│   │   ├── auth.routes.ts        # Auth routes
│   │   ├── admin.routes.ts       # Admin routes
│   │   └── index.ts              # Route aggregator
│   │
│   ├── types/
│   │   ├── auth.types.ts         # Auth-related types
│   │   ├── user.types.ts         # User types
│   │   └── request.types.ts      # Express request extensions
│   │
│   ├── models/
│   │   ├── user.model.ts         # User database operations
│   │   ├── otp.model.ts          # OTP database operations
│   │   └── session.model.ts      # Session database operations
│   │
│   ├── app.ts                    # Express app setup
│   └── server.ts                 # Server entry point
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── scripts/
│   ├── init-database.sql         # Database initialization
│   └── migrate.ts                # Database migrations
│
├── .env.example                  # Environment variables template
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

---

## Database Schema

### 1. Users Table
```sql
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(32) UNIQUE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    password_hash VARCHAR(255) NOT NULL,
    level VARCHAR(10),                      -- 'A1', 'A2', 'B1', etc. or NULL
    role VARCHAR(50) DEFAULT 'user',        -- 'user' or 'admin'
    current_lesson INTEGER,
    total_stars INTEGER DEFAULT 0,
    email_verified BOOLEAN DEFAULT FALSE,
    eval_test_result JSONB,
    session_revoked_at TIMESTAMP,           -- For session revocation
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
```

### 2. OTP Verifications Table
```sql
CREATE TABLE IF NOT EXISTS otp_verifications (
    id SERIAL PRIMARY KEY,
    identifier VARCHAR(255) NOT NULL,        -- email or user_id
    otp_hash VARCHAR(255) NOT NULL,          -- HMAC-SHA256 hash of OTP
    otp_salt VARCHAR(64) NOT NULL,            -- Salt used for hashing
    purpose VARCHAR(50) NOT NULL,            -- 'email_verification', 'login', 'password_reset'
    expires_at TIMESTAMP NOT NULL,
    attempts INTEGER DEFAULT 0 NOT NULL,
    max_attempts INTEGER DEFAULT 5 NOT NULL,
    used BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    used_at TIMESTAMP,
    
    -- Constraints
    CONSTRAINT chk_attempts CHECK (attempts <= max_attempts),
    CONSTRAINT chk_expires_at CHECK (expires_at > created_at),
    CONSTRAINT chk_used_at CHECK (used_at IS NULL OR used = TRUE)
);

-- Indexes
CREATE INDEX idx_otp_verifications_identifier ON otp_verifications(identifier);
CREATE INDEX idx_otp_verifications_purpose ON otp_verifications(purpose);
CREATE INDEX idx_otp_verifications_expires_at ON otp_verifications(expires_at);
CREATE INDEX idx_otp_verifications_used ON otp_verifications(used);
CREATE INDEX idx_otp_verifications_identifier_purpose 
  ON otp_verifications(identifier, purpose, used, expires_at);
```

### 3. User Sessions Table
```sql
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token TEXT NOT NULL,           -- JWT session token
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
```

---

## Core Features Implementation

### 1. OTP System

#### OTP Generation (`src/utils/otp.ts`)
```typescript
import crypto from 'crypto';

export interface OTPResult {
  code: string;
  hash: string;
  salt: string;
}

/**
 * Generate 6-digit OTP
 */
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Hash OTP with salt using HMAC-SHA256
 */
export function hashOTP(otp: string, salt: string): string {
  return crypto.createHmac('sha256', salt).update(otp).digest('hex');
}

/**
 * Generate OTP with hash and salt
 */
export function generateOTPWithHash(): OTPResult {
  const code = generateOTP();
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashOTP(code, salt);
  
  return { code, hash, salt };
}

/**
 * Verify OTP
 */
export function verifyOTP(providedCode: string, storedHash: string, storedSalt: string): boolean {
  const providedHash = hashOTP(providedCode, storedSalt);
  return providedHash === storedHash;
}
```

#### OTP Service (`src/services/otp.service.ts`)
```typescript
import { Pool } from 'pg';
import { generateOTPWithHash, verifyOTP } from '../utils/otp';

export type OTPPurpose = 'email_verification' | 'login' | 'password_reset';

export interface CreateOTPParams {
  identifier: string;  // email
  purpose: OTPPurpose;
  expirationMinutes?: number;
}

export interface VerifyOTPParams {
  identifier: string;
  code: string;
  purpose: OTPPurpose;
}

export class OTPService {
  constructor(private db: Pool) {}

  async createOTP(params: CreateOTPParams): Promise<string> {
    const { identifier, purpose, expirationMinutes = 5 } = params;
    
    // Delete existing unused OTPs
    await this.db.query(
      `DELETE FROM otp_verifications 
       WHERE identifier = $1 AND purpose = $2 AND used = FALSE`,
      [identifier, purpose]
    );

    // Generate OTP
    const { code, hash, salt } = generateOTPWithHash();
    const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);

    // Store in database
    await this.db.query(
      `INSERT INTO otp_verifications 
       (identifier, purpose, otp_hash, otp_salt, expires_at, max_attempts)
       VALUES ($1, $2, $3, $4, $5, 5)`,
      [identifier, purpose, hash, salt, expiresAt]
    );

    return code; // Return plaintext code for email
  }

  async verifyOTP(params: VerifyOTPParams): Promise<boolean> {
    const { identifier, code, purpose } = params;

    // Find most recent unused OTP
    const result = await this.db.query(
      `SELECT id, otp_hash, otp_salt, expires_at, attempts, max_attempts, used
       FROM otp_verifications
       WHERE identifier = $1 AND purpose = $2 AND used = FALSE 
         AND expires_at > CURRENT_TIMESTAMP
       ORDER BY created_at DESC
       LIMIT 1`,
      [identifier, purpose]
    );

    if (result.rows.length === 0) {
      return false;
    }

    const otpRecord = result.rows[0];

    // Check max attempts
    if (otpRecord.attempts >= otpRecord.max_attempts) {
      return false;
    }

    // Increment attempts
    await this.db.query(
      `UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = $1`,
      [otpRecord.id]
    );

    // Verify OTP
    const isValid = verifyOTP(code, otpRecord.otp_hash, otpRecord.otp_salt);

    if (isValid) {
      // Mark as used
      await this.db.query(
        `UPDATE otp_verifications 
         SET used = TRUE, used_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [otpRecord.id]
      );
    }

    return isValid;
  }
}
```

### 2. Registration Flow

#### Registration Controller (`src/controllers/auth.controller.ts`)
```typescript
import { Request, Response } from 'express';
import { OTPService } from '../services/otp.service';
import { EmailService } from '../services/email.service';
import { UserService } from '../services/user.service';
import { SessionService } from '../services/session.service';
import { sanitizeEmail, sanitizeString } from '../utils/sanitize';
import { rateLimitMiddleware } from '../middleware/rateLimit';

export class AuthController {
  constructor(
    private otpService: OTPService,
    private emailService: EmailService,
    private userService: UserService,
    private sessionService: SessionService
  ) {}

  /**
   * POST /api/auth/send-otp
   * Send OTP for registration, login, or password reset
   */
  async sendOTP(req: Request, res: Response): Promise<void> {
    try {
      const { email, type } = req.body;

      // Validate and sanitize
      const sanitizedEmail = sanitizeEmail(email);
      const sanitizedType = sanitizeString(type, 20);

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!sanitizedEmail || !emailRegex.test(sanitizedEmail)) {
        res.status(400).json({ success: false, error: 'Invalid email format' });
        return;
      }

      // Validate type
      const validTypes = ['login', 'signup', 'password_reset'];
      if (!sanitizedType || !validTypes.includes(sanitizedType)) {
        res.status(400).json({ 
          success: false, 
          error: `Invalid type. Must be one of: ${validTypes.join(', ')}` 
        });
        return;
      }

      // Check user existence based on type
      if (sanitizedType === 'signup') {
        const exists = await this.userService.userExists(sanitizedEmail);
        if (exists) {
          res.status(400).json({ 
            success: false, 
            error: 'Account already exists with this email' 
          });
          return;
        }
      } else {
        // login or password_reset
        const exists = await this.userService.userExists(sanitizedEmail);
        if (!exists) {
          res.status(400).json({ 
            success: false, 
            error: 'No account found with this email' 
          });
          return;
        }
      }

      // Determine purpose and expiration
      const purpose = sanitizedType === 'signup' 
        ? 'email_verification' 
        : (sanitizedType === 'password_reset' ? 'password_reset' : 'login');
      
      const expirationMinutes = sanitizedType === 'signup' ? 5 : 10;

      // Generate and store OTP
      const otpCode = await this.otpService.createOTP({
        identifier: sanitizedEmail,
        purpose: purpose as any,
        expirationMinutes
      });

      // Send email
      if (sanitizedType === 'signup') {
        await this.emailService.sendRegistrationConfirmation(sanitizedEmail, otpCode);
      } else if (sanitizedType === 'password_reset') {
        await this.emailService.sendPasswordResetVerification(sanitizedEmail, otpCode);
      } else {
        await this.emailService.sendLoginVerification(sanitizedEmail, otpCode);
      }

      res.json({
        success: true,
        message: 'OTP sent successfully'
      });

    } catch (error) {
      console.error('Send OTP error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to send verification code' 
      });
    }
  }

  /**
   * POST /api/auth/verify-otp
   * Verify OTP and complete registration/login
   */
  async verifyOTP(req: Request, res: Response): Promise<void> {
    try {
      const { email, code, type, firstName, lastName, username, password } = req.body;

      // Sanitize inputs
      const sanitizedEmail = sanitizeEmail(email);
      const sanitizedCode = sanitizeString(code, 10);
      const sanitizedType = sanitizeString(type, 20);

      // Validate required fields
      if (!sanitizedEmail || !sanitizedCode || !sanitizedType) {
        res.status(400).json({ success: false, error: 'Missing required fields' });
        return;
      }

      // Validate OTP format (6 digits)
      if (sanitizedCode.length !== 6 || !/^\d{6}$/.test(sanitizedCode)) {
        res.status(400).json({ success: false, error: 'Invalid OTP format' });
        return;
      }

      // Validate type
      if (!['login', 'signup', 'password_reset'].includes(sanitizedType)) {
        res.status(400).json({ 
          success: false, 
          error: 'Invalid type. Must be "login", "signup", or "password_reset"' 
        });
        return;
      }

      // Determine purpose
      const purpose = sanitizedType === 'signup' 
        ? 'email_verification' 
        : (sanitizedType === 'password_reset' ? 'password_reset' : 'login');

      // Verify OTP
      const isValid = await this.otpService.verifyOTP({
        identifier: sanitizedEmail,
        code: sanitizedCode,
        purpose: purpose as any
      });

      if (!isValid) {
        res.status(400).json({ 
          success: false, 
          error: 'Invalid or expired OTP. Please request a new verification code.' 
        });
        return;
      }

      // Handle password reset (just verify, don't create session)
      if (sanitizedType === 'password_reset') {
        res.json({
          success: true,
          message: 'OTP verified successfully. You can now reset your password.'
        });
        return;
      }

      let user;

      if (sanitizedType === 'login') {
        // Find existing user
        user = await this.userService.findByEmail(sanitizedEmail);
        if (!user) {
          res.status(404).json({ success: false, error: 'Account not found' });
          return;
        }
        await this.userService.updateLastLogin(user.id);
      } else if (sanitizedType === 'signup') {
        // Validate signup fields
        if (!firstName || !lastName || !username || !password) {
          res.status(400).json({ 
            success: false, 
            error: 'First name, last name, username, and password are required for signup' 
          });
          return;
        }

        // Create new user
        user = await this.userService.createUser({
          email: sanitizedEmail,
          username: sanitizeString(username.toLowerCase().trim(), 32),
          firstName: sanitizeString(firstName, 100),
          lastName: sanitizeString(lastName, 100),
          password: password,
          role: username === 'admin' ? 'admin' : 'user'
        });
      }

      // Create session and tokens
      const { accessToken, sessionToken, adminToken } = 
        await this.sessionService.createSession(user);

      // Set HTTP-only cookies
      const cookieOptions = this.getCookieOptions(req);
      res.cookie('access_token', accessToken, cookieOptions);
      res.cookie('session_token', sessionToken, cookieOptions);
      
      if (adminToken) {
        res.cookie('admin_token', adminToken, cookieOptions);
      }

      res.json({
        success: true,
        message: sanitizedType === 'login' ? 'Login successful' : 'Account created successfully',
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.first_name,
          lastName: user.last_name,
          level: user.level,
          role: user.role
        },
        token: accessToken,
        sessionToken: sessionToken
      });

    } catch (error) {
      console.error('Verify OTP error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  private getCookieOptions(req: Request) {
    const isProduction = process.env.NODE_ENV === 'production';
    const isLocalhost = !isProduction && 
      (!process.env.COOKIE_DOMAIN || process.env.COOKIE_DOMAIN === 'localhost');

    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: isLocalhost ? 'lax' : (isProduction ? 'strict' : 'lax'),
      path: '/',
      domain: (process.env.COOKIE_DOMAIN && !isLocalhost) 
        ? process.env.COOKIE_DOMAIN 
        : undefined,
      maxAge: 86400 * 1000 // 24 hours
    };
  }
}
```

### 3. Password-Based Login

```typescript
/**
 * POST /api/auth/login
 * Login with email/username and password
 */
async login(req: Request, res: Response): Promise<void> {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ 
        success: false, 
        error: 'Username/email and password are required' 
      });
      return;
    }

    // Find user by email or username
    const isEmail = username.includes('@');
    const user = isEmail
      ? await this.userService.findByEmail(username)
      : await this.userService.findByUsername(username);

    if (!user) {
      res.status(401).json({ 
        success: false, 
        error: 'Incorrect email or password' 
      });
      return;
    }

    // Verify password
    const isValidPassword = await this.userService.verifyPassword(
      password, 
      user.password_hash
    );

    if (!isValidPassword) {
      res.status(401).json({ 
        success: false, 
        error: 'Incorrect email or password' 
      });
      return;
    }

    // Update last login
    await this.userService.updateLastLogin(user.id);

    // Create session
    const { accessToken, sessionToken, adminToken } = 
      await this.sessionService.createSession(user);

    // Set cookies
    const cookieOptions = this.getCookieOptions(req);
    res.cookie('access_token', accessToken, cookieOptions);
    res.cookie('session_token', sessionToken, cookieOptions);
    
    if (adminToken) {
      res.cookie('admin_token', adminToken, cookieOptions);
    }

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        level: user.level,
        role: user.role
      },
      token: accessToken,
      sessionToken: sessionToken
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
}
```

---

## Security Features

### 1. Input Sanitization (`src/utils/sanitize.ts`)
```typescript
export function sanitizeString(
  value: string, 
  maxLength: number = 1000
): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .normalize('NFKC')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function sanitizeEmail(email: string): string {
  if (!email || typeof email !== 'string') return '';
  return sanitizeString(email.toLowerCase().trim(), 254);
}

export function sanitizeName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  return sanitizeString(name, 100);
}

export function sanitizeUsername(username: string): string {
  if (!username || typeof username !== 'string') return '';
  return sanitizeString(username.toLowerCase().trim(), 32);
}
```

### 2. Rate Limiting (`src/middleware/rateLimit.ts`)
```typescript
import { Request, Response, NextFunction } from 'express';
import { RateLimitService } from '../services/rateLimit.service';

export function rateLimitMiddleware(
  maxAttempts: number = 10,
  windowMs: number = 900000 // 15 minutes
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const rateLimitService = new RateLimitService();
    const clientId = getClientIdentifier(req);
    
    const result = await rateLimitService.checkFailedAttempts(
      clientId,
      { maxAttempts, windowMs }
    );

    if (!result.allowed) {
      res.status(429).json({
        success: false,
        error: `Too many attempts. Please try again in ${Math.ceil(result.retryAfter! / 60)} minutes.`,
        retryAfter: result.retryAfter,
        rateLimited: true
      });
      return;
    }

    next();
  };
}

function getClientIdentifier(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return String(forwarded).split(',')[0].trim();
  }
  
  const realIp = req.headers['x-real-ip'];
  if (realIp) return String(realIp);
  
  return req.ip || 'unknown';
}
```

### 3. CORS & Security Headers (`src/middleware/security.ts`)
```typescript
import { Request, Response, NextFunction } from 'express';

export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // CORS
  const origin = req.headers.origin;
  const allowedOrigins = getAllowedOrigins();
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('Content-Security-Policy', "default-src 'self'");

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }

  next();
}

function getAllowedOrigins(): string[] {
  const origins = [
    'https://yourdomain.com',
    'https://www.yourdomain.com'
  ];

  if (process.env.NODE_ENV !== 'production') {
    origins.push(
      'http://localhost:3000',
      'http://localhost:3002',
      'http://localhost:8888'
    );
  }

  return origins;
}
```

### 4. JWT Authentication (`src/middleware/auth.ts`)
```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';

export interface AuthRequest extends Request {
  user?: {
    userId: number;
    email: string;
    role: string;
  };
}

export function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  // Try Authorization header first
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    // Fall back to cookie
    token = req.cookies?.access_token;
  }

  if (!token) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    res.status(500).json({ success: false, error: 'JWT configuration error' });
    return;
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as any;
    
    if (decoded.type !== 'access') {
      res.status(401).json({ success: false, error: 'Invalid token type' });
      return;
    }

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };

    next();
  } catch (error) {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

export function authenticateAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  authenticateToken(req, res, () => {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Admin access required' });
      return;
    }
    next();
  });
}
```

---

## API Endpoints

### Authentication Endpoints

| Method | Endpoint | Description | Rate Limit |
|--------|----------|-------------|------------|
| POST | `/api/auth/send-otp` | Send OTP for signup/login/reset | 10/15min |
| POST | `/api/auth/verify-otp` | Verify OTP and complete auth | 10 failed/15min |
| POST | `/api/auth/login` | Login with password | 10 failed/15min |
| POST | `/api/auth/logout` | Logout and revoke session | - |
| GET | `/api/auth/me` | Get current user info | - |
| POST | `/api/auth/reset-password` | Reset password with OTP | 10/15min |
| POST | `/api/auth/change-password` | Change password (authenticated) | - |

### Request/Response Examples

#### Send OTP
```http
POST /api/auth/send-otp
Content-Type: application/json

{
  "email": "user@example.com",
  "type": "signup"
}
```

#### Verify OTP (Signup)
```http
POST /api/auth/verify-otp
Content-Type: application/json

{
  "email": "user@example.com",
  "code": "123456",
  "type": "signup",
  "firstName": "John",
  "lastName": "Doe",
  "username": "johndoe",
  "password": "SecurePassword123!"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "user@example.com",
  "password": "SecurePassword123!"
}
```

---

## Implementation Steps

### Phase 1: Project Setup
1. ✅ Initialize Node.js project with TypeScript
2. ✅ Install dependencies
3. ✅ Set up project structure
4. ✅ Configure TypeScript (`tsconfig.json`)
5. ✅ Set up environment variables (`.env.example`)
6. ✅ Initialize database schema

### Phase 2: Core Infrastructure
1. ✅ Database connection setup
2. ✅ Redis/Upstash client setup
3. ✅ Express app configuration
4. ✅ Middleware setup (CORS, security headers)
5. ✅ Error handling middleware
6. ✅ Logging setup

### Phase 3: Utilities & Services
1. ✅ Input sanitization utilities
2. ✅ OTP generation and verification
3. ✅ Password hashing utilities
4. ✅ JWT token utilities
5. ✅ Email service (Resend)
6. ✅ Rate limiting service
7. ✅ Session service

### Phase 4: Authentication
1. ✅ Send OTP endpoint
2. ✅ Verify OTP endpoint
3. ✅ Password login endpoint
4. ✅ Logout endpoint
5. ✅ Get current user endpoint
6. ✅ Password reset flow

### Phase 5: Security & Middleware
1. ✅ JWT authentication middleware
2. ✅ Admin authorization middleware
3. ✅ Rate limiting middleware
4. ✅ Input validation middleware
5. ✅ Session management

### Phase 6: Testing
1. ✅ Unit tests for utilities
2. ✅ Integration tests for endpoints
3. ✅ E2E tests for auth flows
4. ✅ Security testing

### Phase 7: Documentation & Deployment
1. ✅ API documentation
2. ✅ Deployment configuration
3. ✅ Environment setup guide
4. ✅ README with setup instructions

---

## Dependencies

### package.json
```json
{
  "name": "examscan-backend",
  "version": "1.0.0",
  "description": "TypeScript + Node.js backend with OTP authentication",
  "main": "dist/server.js",
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint src/**/*.ts",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@neondatabase/serverless": "^1.0.2",
    "@upstash/redis": "^1.36.1",
    "bcryptjs": "^2.4.3",
    "cookie-parser": "^1.4.6",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.2",
    "pg": "^8.16.3",
    "resend": "^4.0.0"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/cookie-parser": "^1.4.6",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jsonwebtoken": "^9.0.10",
    "@types/node": "^20.10.0",
    "@types/pg": "^8.10.9",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint": "^8.0.0",
    "jest": "^30.2.0",
    "supertest": "^6.3.3",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.0.0"
  }
}
```

---

## Environment Variables

### .env.example
```bash
# Server
NODE_ENV=development
PORT=3001

# Database (Neon PostgreSQL)
NEON_DATABASE_URL=postgresql://user:password@host/database

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-key

# Email (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxxx

# Rate Limiting (Upstash Redis)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token

# Cookies
COOKIE_DOMAIN=localhost
FRONTEND_URL=http://localhost:3000

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3002
```

---

## Testing Strategy

### Unit Tests
- OTP generation and verification
- Password hashing
- Input sanitization
- JWT token generation/verification

### Integration Tests
- Database operations
- Email service
- Rate limiting service
- Session management

### E2E Tests
- Complete registration flow
- Complete login flow (OTP and password)
- Password reset flow
- Session management
- Rate limiting behavior

### Security Tests
- SQL injection attempts
- XSS attempts
- Brute force protection
- Token validation
- Cookie security

---

## Additional Considerations

### 1. Database Migrations
Use a migration tool like:
- `node-pg-migrate`
- `knex.js`
- `drizzle-kit` (if using Drizzle ORM)

### 2. Logging
Consider using:
- `winston` for structured logging
- `morgan` for HTTP request logging

### 3. Error Handling
Create custom error classes:
```typescript
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
```

### 4. API Documentation
Use:
- `swagger` / `openapi` for API docs
- `swagger-ui-express` for interactive docs

### 5. Monitoring
Consider:
- Health check endpoints
- Metrics collection
- Error tracking (Sentry, etc.)

---

## Next Steps

1. **Review this plan** and adjust based on your specific needs
2. **Set up the project structure** following the outlined structure
3. **Implement Phase 1** (Project Setup)
4. **Implement Phase 2** (Core Infrastructure)
5. **Implement Phase 3** (Utilities & Services)
6. **Implement Phase 4** (Authentication)
7. **Implement Phase 5** (Security & Middleware)
8. **Implement Phase 6** (Testing)
9. **Deploy and document**

---

## Notes

- This plan matches the security and registration features from the Example project
- All OTP codes are hashed before storage (HMAC-SHA256)
- Rate limiting uses Upstash Redis (serverless)
- Sessions are stored in database with automatic cleanup
- HTTP-only cookies are used for token storage
- Input sanitization prevents XSS and injection attacks
- All database queries use parameterized statements

---

**Last Updated**: 2024
**Version**: 1.0.0
