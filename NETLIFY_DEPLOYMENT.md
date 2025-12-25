# Netlify Deployment Guide for ExamScan

This guide covers deploying ExamScan to Netlify after migrating from Cloudflare.

## 🚀 Quick Start

### Prerequisites
- Netlify account
- GitHub repository
- Environment variables configured

### Deploy Steps

1. **Connect Repository**
   - Go to [Netlify](https://app.netlify.com)
   - Click "New site from Git"
   - Connect your GitHub repository

2. **Configure Build Settings**
   - **Branch**: `main` (or your default branch)
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Functions directory**: `functions`

3. **Set Environment Variables**
   In Netlify dashboard → Site settings → Environment variables:

   ```
   RESEND_API_KEY=your_resend_api_key
   FROM_EMAIL=noreply@examscan.app
   NEON_DATABASE_URL=your_neon_database_url
   JWT_SECRET=your_secure_jwt_secret
   NODE_ENV=production
   ```

## 📁 Project Structure

```
examscan/
├── netlify.toml              # Netlify configuration
├── functions/                # Serverless functions
│   ├── send-otp.ts
│   ├── login.ts
│   ├── exams.ts
│   ├── logout.ts
│   └── register.ts
├── src/
│   ├── components/           # React components
│   ├── styles/              # CSS styles
│   └── lib/                 # Utilities
├── dist/                    # Built files (auto-generated)
└── package.json
```

## ⚙️ Configuration Details

### netlify.toml
```toml
[build]
  publish = "dist"
  command = "npm run build"
  functions = "functions"

[build.environment]
  NODE_VERSION = "18"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

[[redirects]]
  from = "/functions/*"
  to = "/.netlify/functions/:splat"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"

[[headers]]
  for = "/.netlify/functions/*"
  [headers.values]
    Access-Control-Allow-Origin = "*"
    Access-Control-Allow-Headers = "Content-Type, Authorization"
    Access-Control-Allow-Methods = "GET, POST, PUT, DELETE, OPTIONS"
```

## 🔧 Environment Variables

### Required Variables
- `RESEND_API_KEY`: API key for Resend email service
- `FROM_EMAIL`: Email address for sending OTPs
- `NEON_DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT token signing

### Setting Up Environment Variables

1. **In Netlify Dashboard:**
   - Site settings → Environment variables
   - Add each variable with its value

2. **For Local Development:**
   - Create `.env` file in project root
   - Copy variables from `.env.example`
   - Fill in actual values

## 🚀 Development Workflow

### Local Development
```bash
# Install dependencies
npm install

# Start development server with Netlify functions
npm run netlify:dev

# Or start Vite dev server
npm run dev
```

### Building for Production
```bash
# Build the project
npm run build

# Test build locally
npm run preview
```

## 🔄 API Endpoints

After migration, all API endpoints change:

### Before (Cloudflare)
```
/functions/send-otp.ts
/functions/login.ts
/functions/exams.ts
/functions/logout.ts
```

### After (Netlify)
```
/.netlify/functions/send-otp
/.netlify/functions/login
/.netlify/functions/exams
/.netlify/functions/logout
```

The frontend code has been updated to use the new URLs.

## 📧 Email Configuration

ExamScan uses Resend for email delivery:

1. **Create Resend Account:** https://resend.com
2. **Get API Key:** Dashboard → API Keys
3. **Verify Domain:** Settings → Domains (verify your domain)
4. **Set Environment Variable:** `RESEND_API_KEY=your_key_here`

## 🗄️ Database Setup

ExamScan uses Neon PostgreSQL:

1. **Create Neon Account:** https://neon.tech
2. **Create Project:** Dashboard → Create project
3. **Get Connection String:** Project → Connection string
4. **Set Environment Variable:** `NEON_DATABASE_URL=your_connection_string`

### Required Tables
The database should have these tables:
- `users` - User accounts
- `email_otps` - OTP codes for authentication
- `exams` - Exam templates and configurations

## 🔒 Security Features

### Enabled Security Headers
- `X-Frame-Options: DENY` - Prevents clickjacking
- `X-XSS-Protection: 1; mode=block` - XSS protection
- `X-Content-Type-Options: nosniff` - MIME sniffing protection
- `Referrer-Policy: strict-origin-when-cross-origin` - Referrer control

### CORS Configuration
- Functions allow cross-origin requests from any domain
- Supports `Content-Type` and `Authorization` headers

## 🧪 Testing Deployment

### Pre-deployment Checklist
- [ ] Environment variables set
- [ ] Database accessible
- [ ] Email service configured
- [ ] Functions build successfully
- [ ] Frontend builds without errors

### Testing Steps
1. **Deploy to Netlify**
2. **Test Authentication:**
   - Visit login page
   - Request OTP
   - Verify OTP works
3. **Test Dashboard:**
   - Create new exam
   - View existing exams
4. **Test Functions:**
   - Check browser network tab
   - Verify API calls work

### Common Issues

#### Functions Not Working
```bash
# Check function logs in Netlify dashboard
# Site settings → Functions → View logs
```

#### Environment Variables Not Set
```bash
# Check Netlify dashboard → Site settings → Environment variables
# Ensure variables are set for production branch
```

#### Build Failures
```bash
# Check build logs in Netlify dashboard
# Common issues: missing dependencies, TypeScript errors
```

## 🚀 Production Deployment

### Automatic Deployments
Netlify automatically deploys when you push to the main branch.

### Manual Deployments
```bash
# Deploy to draft (preview)
npm run netlify:deploy

# Deploy to production
npm run netlify:deploy:prod
```

### Custom Domain
1. Go to Netlify dashboard → Site settings → Domain management
2. Add custom domain
3. Configure DNS records as instructed

## 📊 Monitoring & Analytics

### Netlify Analytics
- View site metrics in Netlify dashboard
- Monitor function performance
- Track build times and success rates

### Error Tracking
- Check function logs for API errors
- Monitor browser console for client-side errors
- Set up error tracking service if needed

## 🔄 Migration from Cloudflare

This project was migrated from Cloudflare Workers to Netlify Functions. Key changes:

### Code Changes
- **Environment Access:** `env.VARIABLE` → `process.env.VARIABLE`
- **Request Handling:** `onRequestPost` → `handler(event)`
- **Response Creation:** `new Response()` → `{ statusCode, headers, body }`
- **JWT Handling:** Custom implementation → `jsonwebtoken` library

### Configuration Changes
- **wrangler.toml** → **netlify.toml**
- **Workers KV/D1** → **Environment variables**
- **Cloudflare Pages** → **Netlify deployment**

### Benefits of Netlify Migration
- ✅ **Better developer experience** with local function testing
- ✅ **Integrated deployment** with Git
- ✅ **Built-in analytics** and monitoring
- ✅ **Form handling** capabilities
- ✅ **Identity management** (optional)

## 📞 Support

For deployment issues:
1. Check Netlify build/function logs
2. Verify environment variables
3. Test locally with `npm run netlify:dev`
4. Check this documentation
5. Contact development team

---

**Last updated:** December 2025
**Version:** 1.0.0
