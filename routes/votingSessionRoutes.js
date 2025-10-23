const express = require('express');
const router = express.Router();
const VotingSessionController = require('../controllers/votingSessionController');
const { authenticate, isAdmin } = require('../middleware/authMiddleware');

// Public routes (authenticated)
router.get('/current', authenticate, VotingSessionController.getCurrentSession);
router.get('/history', authenticate, VotingSessionController.getAllSessions);
router.get('/:sessionId', authenticate, VotingSessionController.getSessionById);

// Admin only routes
router.post('/start', authenticate, isAdmin, VotingSessionController.startVotingSession);
router.post('/end', authenticate, isAdmin, VotingSessionController.endVotingSession);

module.exports = router;
