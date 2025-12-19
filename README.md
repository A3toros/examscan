# ExamScan - Answer Sheet Scanner

A modern web application for generating and scanning answer sheets with AI-powered OCR technology.

## Features

- ✨ **Completely Free**: No subscription fees or hidden costs
- ✨ **Generate Answer Sheets**: Create PDF and Word templates with multiple choice and true/false questions
- 📱 **Mobile Scanning**: Scan answer sheets using device camera with iPhone support
- 🤖 **Computer Vision OCR**: Advanced optical character recognition with OpenCV WASM
- 📊 **AI-Powered Grading**: Intelligent bubble detection with confidence scoring and quality assessment
- 🎨 **Beautiful UI**: Modern design with sky blue gradient theme and smooth animations
- 📧 **OTP Verification**: Secure email verification using Resend
- 🔒 **Enterprise Security**: Input sanitization, rate limiting, and abuse prevention
- ☁️ **Cloud Hosted**: Deployed on Cloudflare Pages and Workers

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS + Framer Motion animations
- **Backend**: Cloudflare Workers (serverless functions)
- **Database**: Neon Database (PostgreSQL)
- **OCR**: OpenCV WASM for client-side processing
- **Deployment**: Cloudflare Pages + Workers

## Database Setup

### Prerequisites
- Neon Database account (https://neon.tech)
- Node.js 18+ and npm

### Schema Files
1. `examscan_schema.sql` - Main database schema
2. `examscan_registration.sql` - Registration and authentication

### Setup Instructions

1. **Create a Neon Database**
   ```bash
   # Sign up at https://neon.tech
   # Create a new project
   ```

2. **Run the Schema Files**
   ```sql
   -- Connect to your Neon database and run:
   -- 1. examscan_schema.sql
   -- 2. examscan_registration.sql
   ```

3. **Configure Environment Variables**
   ```bash
   # Copy .env.example to .env
   cp .env.example .env

   # Database
   DATABASE_URL=postgresql://username:password@hostname/database

   # Cloudflare Workers
   CLOUDFLARE_WORKER_URL=https://your-worker.your-account.workers.dev

   # Resend Email Service
   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   FROM_EMAIL=noreply@examscan.mathayomwatsing.com

   # Supabase (optional, if using)
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   ```

## Development Setup

1. **Clone and Install**
   ```bash
   cd examscan
   npm install
   ```

2. **Environment Configuration**
   ```bash
   # Create .env file
   cp .env.example .env
   # Edit with your configuration
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173)

4. **Build for Production**
   ```bash
   npm run build
   npm run preview
   ```

## Cloudflare Deployment

### Pages Deployment
1. **Connect Repository**
   - Go to Cloudflare Pages dashboard
   - Connect your GitHub repository
   - Set build settings:
     - Build command: `npm run build`
     - Build output directory: `dist`

2. **Environment Variables**
   - Add environment variables in Pages settings
   - `DATABASE_URL`
   - `CLOUDFLARE_WORKER_URL`

### Workers Deployment
1. **Install Wrangler**
   ```bash
   npm install -g wrangler
   ```

2. **Authenticate**
   ```bash
   wrangler auth login
   ```

3. **Deploy Workers**
   ```bash
   cd functions
   wrangler deploy
   ```

## Database Tables Overview

### Core Tables
- `examscan_teachers` - Extended teacher information and subscriptions
- `exams` - Exam definitions with questions and answer keys
- `scanned_results` - OCR scan results and grading
- `scan_sessions` - Batch scanning management for classes

### Supporting Tables
- `exam_questions` - Detailed question information for each exam
- `session_results` - Links scan sessions to individual results
- `email_otps` - OTP codes for email verification
- `api_usage` - Analytics and billing usage tracking

## OTP & Email System

### Registration Flow
1. **User submits registration form**
2. **System generates 6-digit OTP** and sends via Resend
3. **User enters OTP** for verification
4. **Account created** upon successful verification

### Exam Management System
- **Direct Exam Creation**: Build custom exams with multiple choice and true/false questions
- **Integrated Answer Keys**: Secure storage of correct answers within each exam
- **Exam Library**: View, organize, and track all created exams
- **Real-time Statistics**: Monitor scan counts and performance analytics
- **Status Tracking**: Draft, active, completed, and archived exam states

### OTP Features
- **6-digit numeric codes** (000000-999999)
- **10-minute expiration**
- **5 attempt limit** per code
- **Rate limiting** and security tracking
- **Email templates** for different OTP types

## Security Features

### Input Protection
- **XSS Prevention**: Automatic script tag removal and HTML sanitization
- **SQL Injection Protection**: Pattern detection and input escaping
- **CSRF Protection**: Token-based request validation
- **Rate Limiting**: Configurable limits for different actions
- **Input Validation**: Email format, length, and content validation

### Abuse Prevention
- **Bot Detection**: User agent analysis and suspicious pattern detection
- **Spam Filtering**: Content analysis for spam patterns
- **IP Monitoring**: Request tracking and suspicious activity logging
- **Session Security**: Secure session management and timeout handling

### Headers & CSP
- **Content Security Policy**: Prevents XSS and unauthorized script execution
- **Security Headers**: X-Frame-Options, X-Content-Type-Options, etc.
- **HTTPS Enforcement**: Secure communication requirements

### Workers Endpoints
- `GET /templates` - Get user's templates
- `POST /templates` - Create new template
- `POST /scan-results` - Save scan results
- `GET /scan-sessions` - Get scanning sessions
- `POST /send-otp` - Send OTP via Resend
- `POST /verify-otp` - Verify OTP codes
- `POST /register` - Complete user registration

### Authentication
- JWT-based authentication
- Integration with main Mathayomwatsing system
- Email verification for new registrations

## Project Structure

```
examscan/
├── src/
│   ├── components/
│   │   ├── ui/           # Reusable UI components
│   │   ├── LandingPage.tsx
│   │   ├── Dashboard.tsx
│   │   └── Registration.tsx
│   ├── hooks/            # Custom React hooks
│   ├── services/         # API and utility services
│   ├── types/            # TypeScript type definitions
│   └── styles/           # Global styles and themes
├── functions/            # Cloudflare Workers
├── public/               # Static assets
├── database/             # Schema files
│   ├── examscan_schema.sql      # Core database schema (exams, scans, analytics)
│   └── examscan_registration.sql # Registration & OTP system
└── wrangler.toml         # Cloudflare configuration
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For support and questions:
- Create an issue on GitHub
- Contact the development team
- Check the documentation

---

Built with ❤️ using modern web technologies