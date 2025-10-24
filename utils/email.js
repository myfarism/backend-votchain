// src/services/emailService.js
const nodemailer = require('nodemailer');
require('dotenv').config();

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  // Send OTP email
  static async sendOTP(email, otp) {
    const service = new EmailService();
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Verifikasi Email - Kode OTP Sistem Voting Blockchain',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Verifikasi Email - Sistem Voting Blockchain</h2>
          <p>Terima kasih telah mendaftar di sistem voting blockchain yang menggunakan keamanan ECDSA dan enkripsi AES-256.</p>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center;">
            <h1 style="color: #1f2937; font-size: 32px; margin: 0;">${otp}</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Kode OTP Anda</p>
          </div>
          <p style="color: #ef4444; font-weight: bold;">⚠️ Kode akan kedaluwarsa dalam 5 menit.</p>
          <p>Untuk keamanan, jangan bagikan kode ini kepada siapapun.</p>
          <hr style="border: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 12px;">
            Sistem ini menggunakan teknologi blockchain dengan algoritma kriptografi ECDSA untuk digital signature 
            dan AES-256 untuk enkripsi data guna memastikan transparansi dan keamanan voting.
          </p>
        </div>
      `
    };

    try {
      await service.transporter.sendMail(mailOptions);
      console.log(`✅ OTP email sent to ${email}`);
    } catch (error) {
      console.error('❌ Email sending error:', error);
      throw error;
    }
  }

  // Send vote confirmation email
  static async sendVoteConfirmation(email, candidateName, transactionHash) {
    const service = new EmailService();
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Konfirmasi Vote - Sistem Voting Blockchain',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #059669;">Vote Berhasil Dicatat</h2>
          <p>Vote Anda telah berhasil dicatat dalam sistem blockchain dengan keamanan tinggi.</p>
          <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; border-left: 4px solid #059669;">
            <p><strong>Kandidat yang dipilih:</strong> ${candidateName}</p>
            <p><strong>Transaction Hash:</strong> <code style="background: #f3f4f6; padding: 2px 4px; border-radius: 3px;">${transactionHash}</code></p>
            <p><strong>Status:</strong> ✅ Terverifikasi di Blockchain</p>
          </div>
          <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
            Vote Anda telah dienkripsi dengan AES-256 dan ditandatangani secara digital dengan ECDSA untuk memastikan integritas dan kerahasiaan.
          </p>
        </div>
      `
    };

    try {
      await service.transporter.sendMail(mailOptions);
      console.log(`✅ Vote confirmation email sent to ${email}`);
    } catch (error) {
      console.error('❌ Vote confirmation email error:', error);
      throw error;
    }
  }

  // Send welcome email after successful registration
  static async sendWelcomeEmail(email, username, ethereumAddress) {
    const service = new EmailService();
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Selamat Datang - Sistem Voting Blockchain',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Selamat Datang di Sistem Voting Blockchain!</h2>
          <p>Halo <strong>${username}</strong>,</p>
          <p>Akun blockchain Anda telah berhasil dibuat dan diverifikasi. Berikut detail akun Anda:</p>
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <p><strong>Username:</strong> ${username}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Ethereum Address:</strong> <code style="background: #e2e8f0; padding: 2px 4px; border-radius: 3px; font-size: 12px;">${ethereumAddress}</code></p>
            <p><strong>Status:</strong> ✅ Terverifikasi dan Terdaftar di Blockchain</p>
          </div>
          <p>Anda sekarang dapat berpartisipasi dalam voting dengan keamanan tinggi menggunakan teknologi blockchain.</p>
          <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
            <p style="margin: 0; color: #92400e;">
              <strong>🔐 Keamanan Terjamin:</strong> Sistem ini menggunakan enkripsi AES-256 dan digital signature ECDSA untuk melindungi data dan vote Anda.
            </p>
          </div>
        </div>
      `
    };

    try {
      await service.transporter.sendMail(mailOptions);
      console.log(`✅ Welcome email sent to ${email}`);
    } catch (error) {
      console.error('❌ Welcome email error:', error);
      throw error;
    }
  }

  // Send Password Reset OTP email
  static async sendPasswordResetOTP(email, otp) {
    const service = new EmailService();
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Reset Password - Kode OTP Verifikasi',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Reset Password - Sistem Voting Blockchain</h2>
          <p>Kami menerima permintaan untuk mereset password akun Anda.</p>
          <p>Gunakan kode OTP berikut untuk melanjutkan proses reset password:</p>
          <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; text-align: center; border: 2px solid #fca5a5;">
            <h1 style="color: #991b1b; font-size: 32px; margin: 0; letter-spacing: 4px;">${otp}</h1>
            <p style="color: #7f1d1d; margin: 10px 0 0 0; font-weight: 600;">Kode OTP Reset Password</p>
          </div>
          <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
            <p style="margin: 0; color: #92400e;">
              <strong>⚠️ PENTING:</strong> Kode ini akan kedaluwarsa dalam <strong>5 menit</strong>.
            </p>
          </div>
          <div style="background-color: #fee2e2; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #991b1b; font-size: 14px;">
              <strong>🔐 Tips Keamanan:</strong>
            </p>
            <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #7f1d1d;">
              <li>Jangan bagikan kode ini kepada siapapun, termasuk admin</li>
              <li>Jika Anda tidak meminta reset password, abaikan email ini</li>
              <li>Pastikan Anda mengubah password dengan yang kuat dan unik</li>
            </ul>
          </div>
          <p style="color: #6b7280; font-size: 13px; margin-top: 20px;">
            Jika Anda tidak merasa melakukan permintaan reset password, segera amankan akun Anda atau hubungi tim support kami.
          </p>
          <hr style="border: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #9ca3af; font-size: 11px; text-align: center;">
            Email otomatis dari Sistem Voting Blockchain dengan keamanan ECDSA & AES-256
          </p>
        </div>
      `
    };

    try {
      await service.transporter.sendMail(mailOptions);
      console.log(`✅ Password reset OTP email sent to ${email}`);
    } catch (error) {
      console.error('❌ Password reset OTP email error:', error);
      throw error;
    }
  }


  // Test email connection
  static async testConnection() {
    const service = new EmailService();
    
    try {
      await service.transporter.verify();
      console.log('✅ Email service connection verified');
      return true;
    } catch (error) {
      console.error('❌ Email service connection failed:', error);
      return false;
    }
  }
}

module.exports = EmailService;