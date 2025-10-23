const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/adminController');
const { authenticate, isAdmin } = require('../middleware/authMiddleware');

// All routes require admin authentication
router.use(authenticate, isAdmin);

// User management
router.get('/users', AdminController.getAllUsers);
router.get('/users/:userId', AdminController.getUserById);
router.delete('/users/:userId', AdminController.deleteUser);

// Admin management
router.get('/admins', AdminController.getAllAdmins);
router.post('/admins', AdminController.createAdmin);

// Dashboard & Analytics
router.get('/dashboard', AdminController.getDashboardStats);
router.get('/audit-logs', AdminController.getAuditLogs);

// Blockchain sync
router.post('/sync-blockchain', AdminController.syncBlockchainData);

module.exports = router;
