const { ethers } = require('ethers');
const prisma = require('../lib/prisma');
const web3Config = require('../config/web3');
const ResponseFormatter = require('../utils/responseFormatter');

class VotingSessionController {
  /**
   * Start voting session (Admin only)
   */
  static async startVotingSession(req, res, next) {
    try {
      const { sessionName, description, durationInHours } = req.body;
      const adminEmail = req.user.email;

      if (!sessionName || !durationInHours) {
        return ResponseFormatter.validationError(res, {
          sessionName: sessionName ? null : 'Session name is required',
          durationInHours: durationInHours ? null : 'Duration is required'
        });
      }

      console.log('▶️  Starting voting session...');

      const startTime = Math.floor(Date.now() / 1000);
      const endTime = startTime + (Number(durationInHours) * 3600);

      // Start on blockchain
      const adminWallet = web3Config.getAdminWallet();
      const contract = web3Config.getContractWithSigner(adminWallet);

      const tx = await contract.startVoting(endTime);
      const receipt = await tx.wait();

      console.log('✅ Voting session started on blockchain');
      console.log('Transaction Hash:', receipt.hash);

      // Calculate session hash
      const sessionHash = ethers.keccak256(
        ethers.toUtf8Bytes(`${sessionName}:${startTime}:${endTime}`)
      );

      // Deactivate previous sessions
      await prisma.votingSession.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      });

      // Create new session in database
      const session = await prisma.$transaction(async (txPrisma) => {
        const newSession = await txPrisma.votingSession.create({
          data: {
            sessionName,
            description,
            startTime: new Date(startTime * 1000),
            endTime: new Date(endTime * 1000),
            isActive: true,
            sessionHash,
            createdBy: adminEmail
          }
        });

        await txPrisma.auditLog.create({
          data: {
            action: 'VOTING_SESSION_STARTED',
            performedBy: adminEmail,
            performedByRole: 'admin',
            targetId: newSession.id,
            targetType: 'VotingSession',
            details: `Admin ${adminEmail} started voting session: ${sessionName}`,
            dataHash: receipt.hash
          }
        });

        return newSession;
      });

      return ResponseFormatter.success(
        res,
        {
          session,
          transactionHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          startTime: new Date(startTime * 1000).toISOString(),
          endTime: new Date(endTime * 1000).toISOString()
        },
        'Voting session started successfully',
        201
      );

    } catch (error) {
      console.error('Start voting session error:', error);
      
      if (error.message.includes('Voting is already active')) {
        return ResponseFormatter.error(res, 'Voting session is already active', 400);
      }
      
      next(error);
    }
  }

  /**
   * End voting session (Admin only)
   */
  static async endVotingSession(req, res, next) {
    try {
      const adminEmail = req.user.email;

      console.log('⏹️  Ending voting session...');

      // End on blockchain
      const adminWallet = web3Config.getAdminWallet();
      const contract = web3Config.getContractWithSigner(adminWallet);

      const tx = await contract.endVoting();
      const receipt = await tx.wait();

      console.log('✅ Voting session ended on blockchain');
      console.log('Transaction Hash:', receipt.hash);

      // Update database
      const session = await prisma.$transaction(async (txPrisma) => {
        const activeSession = await txPrisma.votingSession.findFirst({
          where: { isActive: true }
        });

        if (activeSession) {
          const updated = await txPrisma.votingSession.update({
            where: { id: activeSession.id },
            data: { isActive: false }
          });

          await txPrisma.auditLog.create({
            data: {
              action: 'VOTING_SESSION_ENDED',
              performedBy: adminEmail,
              performedByRole: 'admin',
              targetId: activeSession.id,
              targetType: 'VotingSession',
              details: `Admin ${adminEmail} ended voting session: ${activeSession.sessionName}`,
              dataHash: receipt.hash
            }
          });

          return updated;
        }

        return null;
      });

      return ResponseFormatter.success(
        res,
        {
          session,
          transactionHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          endedAt: new Date().toISOString()
        },
        'Voting session ended successfully'
      );

    } catch (error) {
      console.error('End voting session error:', error);
      
      if (error.message.includes('Voting is not active')) {
        return ResponseFormatter.error(res, 'No active voting session', 400);
      }
      
      next(error);
    }
  }

  /**
   * Get current voting session
   */
  static async getCurrentSession(req, res, next) {
    try {
      // Get from blockchain
      const contract = web3Config.getContract();
      const votingStatus = await contract.getVotingStatus();

      // Get from database
      const dbSession = await prisma.votingSession.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' }
      });

      return ResponseFormatter.success(
        res,
        {
          isActive: votingStatus.active,
          blockchain: {
            startTime: Number(votingStatus.startTime),
            endTime: Number(votingStatus.endTime),
            startTimeFormatted: new Date(Number(votingStatus.startTime) * 1000).toISOString(),
            endTimeFormatted: new Date(Number(votingStatus.endTime) * 1000).toISOString()
          },
          database: dbSession ? {
            id: dbSession.id,
            sessionName: dbSession.sessionName,
            description: dbSession.description,
            startTime: dbSession.startTime,
            endTime: dbSession.endTime,
            createdBy: dbSession.createdBy
          } : null
        },
        'Current voting session retrieved successfully'
      );

    } catch (error) {
      console.error('Get current session error:', error);
      next(error);
    }
  }

  /**
   * Get all voting sessions history
   */
  static async getAllSessions(req, res, next) {
    try {
      const { page = 1, limit = 10 } = req.query;

      const skip = (Number(page) - 1) * Number(limit);

      const [sessions, total] = await Promise.all([
        prisma.votingSession.findMany({
          skip,
          take: Number(limit),
          orderBy: { createdAt: 'desc' }
        }),
        prisma.votingSession.count()
      ]);

      return ResponseFormatter.success(
        res,
        {
          sessions,
          pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            totalPages: Math.ceil(total / Number(limit))
          }
        },
        'Voting sessions retrieved successfully'
      );

    } catch (error) {
      console.error('Get all sessions error:', error);
      next(error);
    }
  }

  /**
   * Get session by ID
   */
  static async getSessionById(req, res, next) {
    try {
      const { sessionId } = req.params;

      const session = await prisma.votingSession.findUnique({
        where: { id: sessionId }
      });

      if (!session) {
        return ResponseFormatter.error(res, 'Session not found', 404);
      }

      // Get vote statistics for this session
      const voteStats = await prisma.voteRecord.groupBy({
        by: ['voterProdi'],
        where: {
          timestamp: {
            gte: session.startTime,
            lte: session.endTime
          }
        },
        _count: {
          voterProdi: true
        }
      });

      return ResponseFormatter.success(
        res,
        {
          session,
          statistics: {
            votesByProdi: voteStats.map(v => ({
              prodi: v.voterProdi,
              votes: v._count.voterProdi
            })),
            totalVotes: voteStats.reduce((sum, v) => sum + v._count.voterProdi, 0)
          }
        },
        'Session retrieved successfully'
      );

    } catch (error) {
      console.error('Get session by ID error:', error);
      next(error);
    }
  }
}

module.exports = VotingSessionController;
