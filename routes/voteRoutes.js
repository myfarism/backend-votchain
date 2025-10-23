const express = require('express');
const router = express.Router();
const VoteController = require('../controllers/voteController');
const { authenticate, isUser } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(authenticate);

// User voting routes
router.post('/cast', isUser, VoteController.castVote);
router.get('/status/:walletAddress', VoteController.checkVoterStatus);
router.get('/voting-status', VoteController.getVotingStatus);
router.get('/my-history', isUser, VoteController.getMyVoteHistory);
router.get('/verify/:transactionHash', VoteController.verifyVote);

module.exports = router;
