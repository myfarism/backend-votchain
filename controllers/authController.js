const { ethers } = require('ethers');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const web3Config = require('../config/web3');
const ResponseFormatter = require('../utils/responseFormatter');
const EmailService = require('../utils/email');

const generateOTP = () => crypto.randomInt(100000, 999999).toString();

class AuthController {
  // Get available Hardhat accounts
  static async getAvailableAccounts(req, res, next) {
    try {
      const provider = web3Config.getProvider();
      const accounts = await provider.listAccounts();

      const registeredUsers = await prisma.user.findMany({
        select: { walletAddress: true }
      });
      
      const registeredAddresses = new Set(
        registeredUsers.map(u => u.walletAddress.toLowerCase())
      );

      const availableAccounts = accounts
        .map((addr, index) => {
          const addressString = typeof addr === 'string' ? addr : addr.address;
          return {
            address: addressString,
            index,
            label: `Account #${index}`,
            isAvailable: !registeredAddresses.has(addressString.toLowerCase())
          };
        })
        .filter(acc => acc.isAvailable);

      console.log('📋 Available accounts:', availableAccounts.length);

      return ResponseFormatter.success(
        res,
        {
          availableAccounts: availableAccounts.map(acc => ({
            address: acc.address,
            index: acc.index,
            label: acc.label
          })),
          totalAccounts: accounts.length,
          registeredAccounts: registeredAddresses.size,
          availableCount: availableAccounts.length
        },
        'Available accounts retrieved successfully'
      );

    } catch (error) {
      console.error('Get available accounts error:', error);
      next(error);
    }
  }


  // User Registration
  static async registerUser(req, res, next) {
    try {
      const { email, username, nim, prodi, password, walletAddress } = req.body;

      if (!email || !username || !nim || !prodi || !password) {
        return ResponseFormatter.validationError(res, {
          email: email ? null : 'Email is required',
          username: username ? null : 'Username is required',
          nim: nim ? null : 'NIM is required',
          prodi: prodi ? null : 'Program Studi is required',
          password: password ? null : 'Password is required'
        });
      }

      let assignedWallet = walletAddress;
      let assignedPrivateKey = null;
      
      if (!assignedWallet) {
        const provider = web3Config.getProvider();
        const accounts = await provider.listAccounts();
        
        const registeredUsers = await prisma.user.findMany({
          select: { walletAddress: true }
        });
        
        const registeredAddresses = new Set(
          registeredUsers.map(u => u.walletAddress.toLowerCase())
        );

        const availableAccount = accounts.find(addr => {
          const addressString = typeof addr === 'string' ? addr : addr.address;
          return !registeredAddresses.has(addressString.toLowerCase());
        });

        if (!availableAccount) {
          return ResponseFormatter.error(
            res,
            'No available wallet addresses. All Hardhat accounts are registered.',
            400
          );
        }

        assignedWallet = typeof availableAccount === 'string' 
          ? availableAccount 
          : availableAccount.address;

        console.log('🔑 Auto-assigned wallet:', assignedWallet);
      }

      if (!ethers.isAddress(assignedWallet)) {
        return ResponseFormatter.validationError(res, {
          walletAddress: 'Invalid Ethereum address format'
        });
      }

      // Get private key dari Hardhat accounts
      assignedPrivateKey = getPrivateKeyByAddress(assignedWallet);

      if (!assignedPrivateKey) {
        return ResponseFormatter.error(
          res,
          'Private key not found for assigned wallet address',
          500
        );
      }

      // Encrypt private key
      const encryptedPrivateKey = EncryptionHelper.encrypt(assignedPrivateKey);

      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email },
            { nim },
            { walletAddress: assignedWallet }
          ]
        }
      });

      if (existingUser) {
        return ResponseFormatter.error(
          res,
          'User already exists with this email, NIM, or wallet address',
          400
        );
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const otp = generateOTP();
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

      console.log('📝 Creating new user registration...');
      console.log('Email:', email);
      console.log('Wallet:', assignedWallet);
      console.log('🔐 Private key encrypted and stored');

      const result = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email,
            username,
            nim,
            prodi,
            password: hashedPassword,
            walletAddress: assignedWallet,
            encryptedPrivateKey, // ✅ SAVE ENCRYPTED PRIVATE KEY
            isVerified: false
          }
        });

        await tx.oTP.create({
          data: {
            email,
            otp,
            expiresAt: otpExpiry
          }
        });

        return newUser;
      });

      await sendOTPEmail(email, otp);

      console.log('✅ User registered successfully');

      return ResponseFormatter.success(
        res,
        {
          userId: result.id,
          email: result.email,
          username: result.username,
          walletAddress: result.walletAddress,
          // ✅ RETURN ENCRYPTED PRIVATE KEY ke client
          encryptedPrivateKey: result.encryptedPrivateKey
        },
        'Registration successful. Please verify your email with OTP.',
        201
      );

    } catch (error) {
      console.error('Registration error:', error);
      next(error);
    }
  }


  // Verify OTP
  static async verifyOTP(req, res, next) {
    try {
      const { email, otp } = req.body;

      if (!email || !otp) {
        return ResponseFormatter.validationError(res, {
          email: email ? null : 'Email is required',
          otp: otp ? null : 'OTP is required'
        });
      }

      console.log('🔍 Verifying OTP for:', email);

      const otpRecord = await prisma.oTP.findFirst({
        where: {
          email,
          otp,
          expiresAt: { gt: new Date() }
        }
      });

      if (!otpRecord) {
        return ResponseFormatter.error(res, 'Invalid or expired OTP', 400);
      }

      const user = await prisma.user.findUnique({
        where: { email }
      });

      if (!user) {
        return ResponseFormatter.error(res, 'User not found', 404);
      }

      if (user.isVerified) {
        return ResponseFormatter.error(res, 'Email is already verified', 400);
      }

      console.log('⛓️  Registering voter on blockchain...');
      const adminWallet = web3Config.getAdminWallet();
      const contract = web3Config.getContractWithSigner(adminWallet);

      const tx = await contract.registerVoter(
        user.walletAddress,
        user.email,
        user.username,
        user.nim,
        user.prodi
      );
      const receipt = await tx.wait();

      console.log('✅ Voter registered on blockchain');
      console.log('Transaction Hash:', receipt.hash);

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: {
            isVerified: true,
            registeredOnChain: true,
            registrationHash: receipt.hash
          }
        });

        await tx.oTP.delete({
          where: { id: otpRecord.id }
        });

        await tx.auditLog.create({
          data: {
            action: 'USER_VERIFIED',
            performedBy: user.email,
            performedByRole: 'user',
            targetId: user.id,
            targetType: 'User',
            details: `User ${user.email} verified and registered on blockchain`,
            dataHash: receipt.hash
          }
        });
      });

      return ResponseFormatter.success(
        res,
        {
          email: user.email,
          username: user.username,
          walletAddress: user.walletAddress,
          transactionHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          verifiedAt: new Date().toISOString(),
          // ✅ RETURN ENCRYPTED PRIVATE KEY
          encryptedPrivateKey: user.encryptedPrivateKey
        },
        'Email verified successfully. You can now login.'
      );

    } catch (error) {
      console.error('OTP verification error:', error);
      
      if (error.message.includes('Voter already registered')) {
        return ResponseFormatter.error(res, 'Voter already registered on blockchain', 400);
      }
      
      next(error);
    }
  }

  // Resend OTP
  static async resendOTP(req, res, next) {
    try {
      const { email } = req.body;

      if (!email) {
        return ResponseFormatter.validationError(res, {
          email: 'Email is required'
        });
      }

      const user = await prisma.user.findUnique({
        where: { email }
      });

      if (!user) {
        return ResponseFormatter.error(res, 'User not found', 404);
      }

      if (user.isVerified) {
        return ResponseFormatter.error(res, 'Email is already verified', 400);
      }

      console.log('📧 Resending OTP to:', email);

      const otp = generateOTP();
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

      await prisma.$transaction(async (tx) => {
        await tx.oTP.deleteMany({
          where: { email }
        });

        await tx.oTP.create({
          data: {
            email,
            otp,
            expiresAt: otpExpiry
          }
        });
      });

      await sendOTPEmail(email, otp);

      console.log('✅ OTP resent successfully');

      return ResponseFormatter.success(
        res,
        { email },
        'OTP has been resent to your email'
      );

    } catch (error) {
      console.error('Resend OTP error:', error);
      next(error);
    }
  }

  // User Login
  static async loginUser(req, res, next) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return ResponseFormatter.validationError(res, {
          email: email ? null : 'Email is required',
          password: password ? null : 'Password is required'
        });
      }

      console.log('🔐 Login attempt for:', email);

      const user = await prisma.user.findUnique({
        where: { email }
      });

      if (!user) {
        return ResponseFormatter.error(res, 'Invalid credentials', 401);
      }

      if (!user.isVerified) {
        return ResponseFormatter.error(
          res,
          'Please verify your email first',
          403
        );
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        return ResponseFormatter.error(res, 'Invalid credentials', 401);
      }

      const contract = web3Config.getContract();
      const voterInfo = await contract.getVoterInfo(user.walletAddress);

      if (!voterInfo.isRegistered) {
        return ResponseFormatter.error(
          res,
          'Voter not registered on blockchain',
          403
        );
      }

      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          walletAddress: user.walletAddress,
          nim: user.nim,
          prodi: user.prodi,
          role: 'user'
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      await prisma.auditLog.create({
        data: {
          action: 'USER_LOGIN',
          performedBy: user.email,
          performedByRole: 'user',
          targetId: user.id,
          targetType: 'User',
          details: `User ${user.email} logged in`
        }
      });

      console.log('✅ Login successful');

      return ResponseFormatter.success(
        res,
        {
          token,
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            nim: user.nim,
            prodi: user.prodi,
            walletAddress: user.walletAddress,
            hasVoted: voterInfo.hasVoted,
            votedCandidateId: voterInfo.hasVoted ? Number(voterInfo.votedCandidateId) : null
          },
          // ✅ RETURN ENCRYPTED PRIVATE KEY
          encryptedPrivateKey: user.encryptedPrivateKey
        },
        'Login successful'
      );

    } catch (error) {
      console.error('Login error:', error);
      next(error);
    }
  }

  // Admin Login
  static async loginAdmin(req, res, next) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return ResponseFormatter.validationError(res, {
          email: email ? null : 'Email is required',
          password: password ? null : 'Password is required'
        });
      }

      console.log('🔐 Admin login attempt for:', email);

      const admin = await prisma.admin.findUnique({
        where: { email }
      });

      if (!admin) {
        return ResponseFormatter.error(res, 'Invalid credentials', 401);
      }

      if (!admin.isActive) {
        return ResponseFormatter.error(res, 'Admin account is deactivated', 403);
      }

      const isPasswordValid = await bcrypt.compare(password, admin.password);

      if (!isPasswordValid) {
        return ResponseFormatter.error(res, 'Invalid credentials', 401);
      }

      const token = jwt.sign(
        {
          userId: admin.id,
          email: admin.email,
          walletAddress: admin.walletAddress,
          role: 'admin'
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      await prisma.auditLog.create({
        data: {
          action: 'ADMIN_LOGIN',
          performedBy: admin.email,
          performedByRole: 'admin',
          targetId: admin.id,
          targetType: 'Admin',
          details: `Admin ${admin.email} logged in`
        }
      });

      console.log('✅ Admin login successful');

      return ResponseFormatter.success(
        res,
        {
          token,
          admin: {
            id: admin.id,
            email: admin.email,
            username: admin.username,
            walletAddress: admin.walletAddress,
            role: admin.role
          }
        },
        'Admin login successful'
      );

    } catch (error) {
      console.error('Admin login error:', error);
      next(error);
    }
  }

  // Get User Profile
  static async getUserProfile(req, res, next) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: {
          id: true,
          email: true,
          username: true,
          nim: true,
          prodi: true,
          walletAddress: true,
          isVerified: true,
          registeredOnChain: true,
          createdAt: true
        }
      });

      if (!user) {
        return ResponseFormatter.error(res, 'User not found', 404);
      }

      const contract = web3Config.getContract();
      const voterInfo = await contract.getVoterInfo(user.walletAddress);

      return ResponseFormatter.success(
        res,
        {
          ...user,
          hasVoted: voterInfo.hasVoted,
          votedCandidateId: voterInfo.hasVoted ? Number(voterInfo.votedCandidateId) : null,
          voteTimestamp: voterInfo.hasVoted ? Number(voterInfo.voteTimestamp) : null
        },
        'Profile retrieved successfully'
      );

    } catch (error) {
      console.error('Get profile error:', error);
      next(error);
    }
  }

  // Forgot Password
  static async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;

      if (!email) {
        return ResponseFormatter.validationError(res, {
          email: 'Email is required'
        });
      }

      const user = await prisma.user.findUnique({
        where: { email }
      });

      if (!user) {
        return ResponseFormatter.error(res, 'User not found', 404);
      }

      console.log('🔑 Password reset requested for:', email);

      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetPasswordToken: resetToken,
          resetPasswordExpiry: resetTokenExpiry
        }
      });

      const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Password Reset Request',
        html: `
          <h2>Password Reset</h2>
          <p>You requested a password reset. Click the link below to reset your password:</p>
          <a href="${resetURL}">${resetURL}</a>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this, please ignore this email.</p>
        `
      };

      await transporter.sendMail(mailOptions);

      console.log('✅ Password reset email sent');

      return ResponseFormatter.success(
        res,
        { email },
        'Password reset link has been sent to your email'
      );

    } catch (error) {
      console.error('Forgot password error:', error);
      next(error);
    }
  }

  // Reset Password
  static async resetPassword(req, res, next) {
    try {
      const { token } = req.params;
      const { newPassword } = req.body;

      if (!newPassword) {
        return ResponseFormatter.validationError(res, {
          newPassword: 'New password is required'
        });
      }

      if (newPassword.length < 8) {
        return ResponseFormatter.validationError(res, {
          newPassword: 'Password must be at least 8 characters'
        });
      }

      console.log('🔄 Resetting password...');

      const user = await prisma.user.findFirst({
        where: {
          resetPasswordToken: token,
          resetPasswordExpiry: { gt: new Date() }
        }
      });

      if (!user) {
        return ResponseFormatter.error(res, 'Invalid or expired reset token', 400);
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetPasswordToken: null,
          resetPasswordExpiry: null
        }
      });

      console.log('✅ Password reset successful');

      return ResponseFormatter.success(
        res,
        { email: user.email },
        'Password has been reset successfully'
      );

    } catch (error) {
      console.error('Reset password error:', error);
      next(error);
    }
  }
}

module.exports = AuthController;
