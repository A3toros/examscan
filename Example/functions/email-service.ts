import { Resend } from 'resend';
import type { CreateEmailResponse } from 'resend';

// Environment variables interface
interface Env {

  RESEND_API_KEY?: string
  FRONTEND_URL?: string
}

// Email options interface
interface EmailOptions {
  to: string
  subject: string
  html: string
  from?: string
}

// Use the proper Resend type

// Initialize Resend with API key from environment variables
console.log('Email service: Environment variables check:');
console.log('  RESEND_API_KEY:', process.env.RESEND_API_KEY ? `Present (starts with: ${process.env.RESEND_API_KEY.substring(0, 8)}...)` : 'Missing');

// Get API key from environment variable
const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
    console.error('Email service: CRITICAL ERROR - No Resend API key found! Please set RESEND_API_KEY environment variable');
}

const resend = new Resend(apiKey);

/**
 * Send email using Resend service
 */
async function sendEmail({ to, subject, html, from = 'noreply@testingportal.org' }: EmailOptions): Promise<CreateEmailResponse> {
    try {
        console.log('Email service: Attempting to send email via Resend', {
            from,
            to: [to],
            subject,
            htmlPreview: html.substring(0, 100) + '...'
        });

        const data = await resend.emails.send({
            from,
            to: [to],
            subject,
            html,
        });

        console.log('Email service: Email sent successfully via Resend:', data);
        return data;
    } catch (error) {
        console.error('Email service: Email sending failed:', error);
        console.error('Email service: Error details:', error instanceof Error ? error.message : String(error));
        throw new Error('Failed to send email');
    }
}

/**
 * Send registration confirmation email
 */
async function sendRegistrationConfirmation(email: string, confirmationCode: string): Promise<CreateEmailResponse> {
    console.log('Email service: Preparing to send registration confirmation', {
        email,
        confirmationCode,
        frontendUrl: process.env.FRONTEND_URL
    });

    const subject = 'Confirm Your TutorCat Registration';
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to TutorCat! 🐱</h2>
            <p>Thank you for registering! Please confirm your email address to activate your account.</p>

            <div style="background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
                <h3 style="margin: 0 0 10px 0; color: #495057;">Your Verification Code</h3>
                <div style="font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 8px; font-family: monospace;">
                    ${confirmationCode}
                </div>
            </div>

            <p>Please enter this 6-digit code in the registration form to complete your account setup.</p>
            <p><strong>This code will expire in 5 minutes.</strong></p>
            <p>If you didn't register for this account, please ignore this email.</p>

            <hr style="border: none; border-top: 1px solid #e9ecef; margin: 30px 0;">
            <p style="font-size: 12px; color: #6c757d;">
                This is an automated message from TutorCat. Please do not reply to this email.
            </p>
        </div>
    `;

    console.log('Email service: Calling sendEmail for registration confirmation', {
        to: email,
        subject,
        htmlLength: html.length
    });

    const result = await sendEmail({ to: email, subject, html });
    console.log('Email service: Registration confirmation email sent successfully', result);
    return result;
}

/**
 * Send login verification email
 */
async function sendLoginVerification(email: string, loginCode: string): Promise<CreateEmailResponse> {
    console.log('Email service: Preparing to send login verification', {
        email,
        loginCode
    });

    const subject = 'Your TutorCat Login Code';
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome back to TutorCat! 🐱</h2>
            <p>Use this code to sign in to your account:</p>

            <div style="background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
                <h3 style="margin: 0 0 10px 0; color: #495057;">Your Login Code</h3>
                <div style="font-size: 32px; font-weight: bold; color: #28a745; letter-spacing: 8px; font-family: monospace;">
                    ${loginCode}
                </div>
            </div>

            <p>This code will expire in 10 minutes.</p>
            <p>If you didn't request this code, please ignore this email.</p>

            <hr style="border: none; border-top: 1px solid #e9ecef; margin: 30px 0;">
            <p style="font-size: 12px; color: #6c757d;">
                This is an automated message from TutorCat. Please do not reply to this email.
            </p>
        </div>
    `;

    const result = await sendEmail({ to: email, subject, html });
    console.log('Email service: Login verification email sent successfully', result);
    return result;
}

/**
 * Send password reset verification email
 */
async function sendPasswordResetVerification(email: string, resetCode: string): Promise<CreateEmailResponse> {
    console.log('Email service: Preparing to send password reset verification', {
        email,
        resetCode
    });

    const subject = 'Reset Your TutorCat Password';
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Password Reset Request 🐱</h2>
            <p>We received a request to reset your password. Use this code to verify your identity:</p>

            <div style="background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
                <h3 style="margin: 0 0 10px 0; color: #856404;">Your Reset Code</h3>
                <div style="font-size: 32px; font-weight: bold; color: #ff6b35; letter-spacing: 8px; font-family: monospace;">
                    ${resetCode}
                </div>
            </div>

            <p>This code will expire in 10 minutes.</p>
            <p><strong>If you didn't request a password reset, please ignore this email. Your password will remain unchanged.</strong></p>

            <hr style="border: none; border-top: 1px solid #e9ecef; margin: 30px 0;">
            <p style="font-size: 12px; color: #6c757d;">
                This is an automated message from TutorCat. Please do not reply to this email.
            </p>
        </div>
    `;

    const result = await sendEmail({ to: email, subject, html });
    console.log('Email service: Password reset verification email sent successfully', result);
    return result;
}

export {
    sendEmail,
    sendRegistrationConfirmation,
    sendLoginVerification,
    sendPasswordResetVerification
};
