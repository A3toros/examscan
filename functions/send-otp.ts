import { Resend } from 'resend';

interface Env {
  RESEND_API_KEY: string;
  FROM_EMAIL: string;
}

interface OTPEmailData {
  to: string;
  otp: string;
  type: 'email_verification' | 'password_reset' | 'login_2fa';
}

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  try {
    const data: OTPEmailData = await request.json();
    const resend = new Resend(env.RESEND_API_KEY);

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
      from: env.FROM_EMAIL,
      to: data.to,
      subject,
      html: htmlContent,
    });

    return new Response(JSON.stringify({
      success: true,
      emailId: result.data?.id,
      message: 'OTP email sent successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error sending OTP email:', error);

    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to send OTP email',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
