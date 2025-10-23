const express = require('express');
const router = express.Router();
const CandidateController = require('../controllers/candidateController');
const { authenticate, isAdmin } = require('../middleware/authMiddleware');

// Public routes (authenticated)
router.get('/', authenticate, CandidateController.getAllCandidates);
router.get('/results', authenticate, CandidateController.getVoteResults);
router.get('/prodi/:prodi', authenticate, CandidateController.getCandidatesByProdi);
router.get('/:candidateId', authenticate, CandidateController.getCandidateById);

// Admin only routes
router.post('/', authenticate, isAdmin, CandidateController.addCandidate);
router.put('/:candidateId', authenticate, isAdmin, CandidateController.updateCandidate);
router.delete('/:candidateId', authenticate, isAdmin, CandidateController.deleteCandidate);

module.exports = router;
