const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');

// Public routes
router.get('/available-accounts', AuthController.getAvailableAccounts);
router.post('/register', AuthController.registerUser);
router.post('/verify-otp', AuthController.verifyOTP);
router.post('/resend-otp', AuthController.resendOTP);
router.post('/login', AuthController.loginUser);
router.post('/login/admin', AuthController.loginAdmin);
router.post('/forgot-password', AuthController.forgotPassword);
router.post('/reset-password/:token', AuthController.resetPassword);

// Protected routes
router.get('/profile', authenticate, AuthController.getUserProfile);

module.exports = router;
