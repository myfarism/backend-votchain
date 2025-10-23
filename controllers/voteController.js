const { ethers } = require('ethers');
const prisma = require('../lib/prisma');
const web3Config = require('../config/web3');
const SignatureHelper = require('../utils/signatureHelper');
const ResponseFormatter = require('../utils/responseFormatter');

class VoteController {
  /**
   * Cast vote with signature verification
   */
  static async castVote(req, res, next) {
    try {
      const { candidateId, voterPrivateKey } = req.body;
      const userId = req.user.userId;

      // Validation
      if (!candidateId || !voterPrivateKey) {
        return ResponseFormatter.validationError(res, {
          candidateId: candidateId ? null : 'Candidate ID is required',
          voterPrivateKey: voterPrivateKey ? null : 'Voter private key is required'
        });
      }

      // Get user from database
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user || !user.isVerified) {
        return ResponseFormatter.error(res, 'User not verified', 403);
      }

      const provider = web3Config.getProvider();
      const voterWallet = web3Config.getWallet(voterPrivateKey);
      const contract = web3Config.getContractWithSigner(voterWallet);

      // Verify wallet address matches user
      if (voterWallet.address.toLowerCase() !== user.walletAddress.toLowerCase()) {
        return ResponseFormatter.error(res, 'Private key does not match your wallet address', 403);
      }

      // Check if voter is registered
      const voterInfo = await contract.getVoterInfo(voterWallet.address);
      if (!voterInfo.isRegistered) {
        return ResponseFormatter.error(res, 'Voter is not registered', 403);
      }

      if (voterInfo.hasVoted) {
        return ResponseFormatter.error(res, 'You have already voted', 403);
      }

      // Check voting session status
      const votingStatus = await contract.getVotingStatus();
      if (!votingStatus.active) {
        return ResponseFormatter.error(res, 'Voting session is not active', 403);
      }

      // Get candidate info to verify prodi
      const candidate = await contract.getCandidate(candidateId);
      
      if (!candidate.isActive) {
        return ResponseFormatter.error(res, 'Candidate is not active', 403);
      }

      // Verify prodi match
      if (candidate.prodi.toLowerCase() !== user.prodi.toLowerCase()) {
        return ResponseFormatter.error(res, 'You can only vote for candidates in your prodi', 403);
      }

      // Create message hash and signature
      const timestamp = Math.floor(Date.now() / 1000);
      const messageHash = SignatureHelper.createVoteMessageHash(
        voterWallet.address,
        candidateId,
        timestamp
      );

      const signature = await SignatureHelper.signMessageHash(
        messageHash,
        voterPrivateKey,
        provider
      );

      console.log('🗳️  Casting vote...');
      console.log('Voter:', voterWallet.address);
      console.log('Candidate ID:', candidateId);
      console.log('Message Hash:', messageHash);

      // Cast vote on blockchain
      const tx = await contract.vote(candidateId, messageHash, signature);
      const receipt = await tx.wait();

      console.log('✅ Vote casted successfully!');
      console.log('Transaction Hash:', receipt.hash);

      // Save vote record in database
      await prisma.$transaction(async (txPrisma) => {
        await txPrisma.voteRecord.create({
          data: {
            voterAddress: voterWallet.address,
            candidateId: Number(candidateId),
            voterProdi: user.prodi,
            messageHash,
            signature,
            verified: true,
            transactionHash: receipt.hash,
            blockNumber: receipt.blockNumber
          }
        });

        // Update candidate vote count in database
        await txPrisma.candidate.updateMany({
          where: { candidateId: Number(candidateId) },
          data: { voteCount: { increment: 1 } }
        });

        // Create audit log
        await txPrisma.auditLog.create({
          data: {
            action: 'VOTE_CAST',
            performedBy: user.email,
            performedByRole: 'user',
            targetId: candidateId.toString(),
            targetType: 'Candidate',
            details: `User ${user.email} voted for candidate ID ${candidateId}`,
            dataHash: receipt.hash
          }
        });
      });

      // Get updated candidate info
      const updatedCandidate = await contract.getCandidate(candidateId);

      return ResponseFormatter.success(
        res,
        {
          transactionHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          voter: voterWallet.address,
          candidateId: Number(candidateId),
          candidateName: candidate.name,
          newVoteCount: Number(updatedCandidate.voteCount),
          timestamp: new Date().toISOString(),
          messageHash,
          signatureVerified: true
        },
        'Vote casted successfully',
        201
      );
    } catch (error) {
      console.error('Vote error:', error);
      
      // Handle specific contract errors
      if (error.message.includes('You have already voted')) {
        return ResponseFormatter.error(res, 'You have already voted', 403);
      }
      if (error.message.includes('Voting is not active')) {
        return ResponseFormatter.error(res, 'Voting session is not active', 403);
      }
      if (error.message.includes('You can only vote for candidates in your prodi')) {
        return ResponseFormatter.error(res, 'You can only vote for candidates in your prodi', 403);
      }
      
      next(error);
    }
  }

  /**
   * Check voter status
   */
  static async checkVoterStatus(req, res, next) {
    try {
      const { walletAddress } = req.params;
      
      if (!walletAddress) {
        return ResponseFormatter.validationError(res, {
          walletAddress: 'Wallet address is required'
        });
      }

      console.log('Checking voter status for:', walletAddress);
      const contract = web3Config.getContract();

      const voterInfo = await contract.getVoterInfo(walletAddress);

      return ResponseFormatter.success(
        res,
        {
          address: walletAddress,
          email: voterInfo.email,
          username: voterInfo.username,
          nim: voterInfo.nim,
          prodi: voterInfo.prodi,
          hasVoted: voterInfo.hasVoted,
          votedCandidateId: voterInfo.hasVoted ? Number(voterInfo.votedCandidateId) : null,
          voteTimestamp: voterInfo.hasVoted ? Number(voterInfo.voteTimestamp) : null,
          isRegistered: voterInfo.isRegistered
        },
        'Voter status retrieved successfully'
      );
    } catch (error) {
      console.error('Check voter status error:', error);
      next(error);
    }
  }

  /**
   * Get voting session status
   */
  static async getVotingStatus(req, res, next) {
    try {
      const contract = web3Config.getContract();
      const status = await contract.getVotingStatus();

      // Get from database as well
      const dbSession = await prisma.votingSession.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' }
      });

      return ResponseFormatter.success(
        res,
        {
          isActive: status.active,
          startTime: Number(status.startTime),
          endTime: Number(status.endTime),
          startTimeFormatted: new Date(Number(status.startTime) * 1000).toISOString(),
          endTimeFormatted: new Date(Number(status.endTime) * 1000).toISOString(),
          sessionInfo: dbSession ? {
            id: dbSession.id,
            sessionName: dbSession.sessionName,
            description: dbSession.description
          } : null
        },
        'Voting status retrieved successfully'
      );
    } catch (error) {
      console.error('Get voting status error:', error);
      next(error);
    }
  }

  /**
   * Get vote history for current user
   */
  static async getMyVoteHistory(req, res, next) {
    try {
      const userId = req.user.userId;

      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        return ResponseFormatter.error(res, 'User not found', 404);
      }

      const voteRecord = await prisma.voteRecord.findFirst({
        where: { voterAddress: user.walletAddress }
      });

      if (!voteRecord) {
        return ResponseFormatter.success(
          res,
          { hasVoted: false },
          'No vote history found'
        );
      }

      // Get candidate info
      const candidate = await prisma.candidate.findUnique({
        where: { candidateId: voteRecord.candidateId }
      });

      return ResponseFormatter.success(
        res,
        {
          hasVoted: true,
          candidateId: voteRecord.candidateId,
          candidateName: candidate?.name || 'Unknown',
          votedAt: voteRecord.timestamp,
          transactionHash: voteRecord.transactionHash,
          blockNumber: voteRecord.blockNumber
        },
        'Vote history retrieved successfully'
      );

    } catch (error) {
      console.error('Get vote history error:', error);
      next(error);
    }
  }

  /**
   * Verify vote signature
   */
  static async verifyVote(req, res, next) {
    try {
      const { transactionHash } = req.params;

      const voteRecord = await prisma.voteRecord.findUnique({
        where: { transactionHash }
      });

      if (!voteRecord) {
        return ResponseFormatter.error(res, 'Vote record not found', 404);
      }

      const isValid = SignatureHelper.verifySignature(
        voteRecord.messageHash,
        voteRecord.signature,
        voteRecord.voterAddress
      );

      return ResponseFormatter.success(
        res,
        {
          transactionHash,
          voterAddress: voteRecord.voterAddress,
          candidateId: voteRecord.candidateId,
          messageHash: voteRecord.messageHash,
          signature: voteRecord.signature,
          isValid,
          timestamp: voteRecord.timestamp
        },
        'Vote verification completed'
      );

    } catch (error) {
      console.error('Verify vote error:', error);
      next(error);
    }
  }
}

module.exports = VoteController;
