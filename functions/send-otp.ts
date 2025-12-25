import { Resend } from 'resend';
import { neon } from '@neondatabase/serverless';

interface OTPEmailData {
  to: string;
  otp: string;
  type: 'email_verification' | 'password_reset' | 'login_2fa';
}

import { NetlifyEvent } from './types.js';

export async function handler(event: NetlifyEvent) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  try {
    const data: OTPEmailData = JSON.parse(event.body || '{}');

    if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL || !process.env.NEON_DATABASE_URL) {
      throw new Error('Missing required environment variables');
    }

    // Store OTP in database for verification (except for password reset which might not need storage)
    if (data.type === 'email_verification' || data.type === 'login_2fa') {
      const sql = neon(process.env.NEON_DATABASE_URL);
      const otpType = data.type === 'email_verification' ? 'registration' : 'login';

      // First, mark any existing unused OTPs for this email/type as used
      await sql`
        UPDATE otps
        SET is_used = true
        WHERE email = ${data.to} AND otp_type = ${otpType} AND is_used = false
      `;

      // Insert new OTP
      await sql`
        INSERT INTO otps (email, otp_code, otp_type, expires_at)
        VALUES (${data.to}, ${data.otp}, ${otpType}, CURRENT_TIMESTAMP + INTERVAL '10 minutes')
      `;
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    let subject: string;
    let htmlContent: string;

    switch (data.type) {
      case 'email_verification':
        subject = 'Verify your ExamScan account';
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Welcome to ExamScan!</h2>
            <p>Your verification code is:</p>
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; color: #1f2937; letter-spacing: 4px;">${data.otp}</span>
            </div>
            <p>This code will expire in 10 minutes.</p>
            <p>If you didn't request this code, please ignore this email.</p>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px; text-align: center; color: white;">
              <h3 style="margin: 0 0 10px 0; font-size: 18px;">🎓 Visit our other project: Online Exams</h3>
              <p style="margin: 0 0 15px 0; font-size: 14px;"><strong>Free from paperwork, free from stress</strong></p>
              <a href="https://testingportal.org" style="background: #ffffff; color: #667eea; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Explore Online Exams →</a>
            </div>
          </div>
        `;
        break;

      case 'password_reset':
        subject = 'Reset your ExamScan password';
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">Password Reset Request</h2>
            <p>Your password reset code is:</p>
            <div style="background: #fef2f2; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; color: #dc2626; letter-spacing: 4px;">${data.otp}</span>
            </div>
            <p>This code will expire in 10 minutes.</p>
            <p>If you didn't request this reset, please ignore this email.</p>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px; text-align: center; color: white;">
              <h3 style="margin: 0 0 10px 0; font-size: 18px;">🎓 Visit our other project: Online Exams</h3>
              <p style="margin: 0 0 15px 0; font-size: 14px;"><strong>Free from paperwork, free from stress</strong></p>
              <a href="https://testingportal.org" style="background: #ffffff; color: #667eea; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Explore Online Exams →</a>
            </div>
          </div>
        `;
        break;

      case 'login_2fa':
        subject = 'ExamScan login verification';
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #059669;">Login Verification</h2>
            <p>Your 2FA code is:</p>
            <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; color: #059669; letter-spacing: 4px;">${data.otp}</span>
            </div>
            <p>This code will expire in 10 minutes.</p>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px; text-align: center; color: white;">
              <h3 style="margin: 0 0 10px 0; font-size: 18px;">🎓 Visit our other project: Online Exams</h3>
              <p style="margin: 0 0 15px 0; font-size: 14px;"><strong>Free from paperwork, free from stress</strong></p>
              <a href="https://testingportal.org" style="background: #ffffff; color: #667eea; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Explore Online Exams →</a>
            </div>
          </div>
        `;
        break;

      default:
        throw new Error('Invalid OTP type');
    }

    const result = await resend.emails.send({
      from: process.env.FROM_EMAIL!,
      to: data.to,
      subject,
      html: htmlContent,
    });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        emailId: result.data?.id,
        message: 'OTP email sent successfully'
      })
    };

  } catch (error) {
    console.error('Error sending OTP email:', error);

    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: 'Failed to send OTP email',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}
