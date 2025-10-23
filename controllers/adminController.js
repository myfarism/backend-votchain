const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const web3Config = require('../config/web3');
const ResponseFormatter = require('../utils/responseFormatter');

class AdminController {
  /**
   * Get all users
   */
  static async getAllUsers(req, res, next) {
    try {
      const { prodi, isVerified, hasVoted, page = 1, limit = 10 } = req.query;

      const where = {};
      
      if (prodi) where.prodi = prodi;
      if (isVerified !== undefined) where.isVerified = isVerified === 'true';

      const skip = (Number(page) - 1) * Number(limit);

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
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
          },
          skip,
          take: Number(limit),
          orderBy: { createdAt: 'desc' }
        }),
        prisma.user.count({ where })
      ]);

      // Get voting status from blockchain if needed
      const contract = web3Config.getContract();
      const usersWithVoteStatus = await Promise.all(
        users.map(async (user) => {
          try {
            if (user.registeredOnChain) {
              const voterInfo = await contract.getVoterInfo(user.walletAddress);
              return {
                ...user,
                hasVoted: voterInfo.hasVoted,
                votedCandidateId: voterInfo.hasVoted ? Number(voterInfo.votedCandidateId) : null
              };
            }
          } catch (error) {
            console.error(`Error getting voter info for ${user.walletAddress}:`, error.message);
          }
          return { ...user, hasVoted: false, votedCandidateId: null };
        })
      );

      // Filter by hasVoted if specified
      let filteredUsers = usersWithVoteStatus;
      if (hasVoted !== undefined) {
        const hasVotedBool = hasVoted === 'true';
        filteredUsers = usersWithVoteStatus.filter(u => u.hasVoted === hasVotedBool);
      }

      return ResponseFormatter.success(
        res,
        {
          users: filteredUsers,
          pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            totalPages: Math.ceil(total / Number(limit))
          }
        },
        'Users retrieved successfully'
      );

    } catch (error) {
      console.error('Get all users error:', error);
      next(error);
    }
  }

  /**
   * Get user by ID
   */
  static async getUserById(req, res, next) {
    try {
      const { userId } = req.params;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          username: true,
          nim: true,
          prodi: true,
          walletAddress: true,
          isVerified: true,
          registeredOnChain: true,
          registrationHash: true,
          createdAt: true,
          updatedAt: true
        }
      });

      if (!user) {
        return ResponseFormatter.error(res, 'User not found', 404);
      }

      // Get blockchain info
      if (user.registeredOnChain) {
        const contract = web3Config.getContract();
        const voterInfo = await contract.getVoterInfo(user.walletAddress);

        return ResponseFormatter.success(
          res,
          {
            ...user,
            blockchain: {
              hasVoted: voterInfo.hasVoted,
              votedCandidateId: voterInfo.hasVoted ? Number(voterInfo.votedCandidateId) : null,
              voteTimestamp: voterInfo.hasVoted ? Number(voterInfo.voteTimestamp) : null
            }
          },
          'User retrieved successfully'
        );
      }

      return ResponseFormatter.success(res, user, 'User retrieved successfully');

    } catch (error) {
      console.error('Get user by ID error:', error);
      next(error);
    }
  }

  /**
   * Delete user (soft delete - deactivate)
   */
  static async deleteUser(req, res, next) {
    try {
      const { userId } = req.params;
      const adminEmail = req.user.email;

      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        return ResponseFormatter.error(res, 'User not found', 404);
      }

      // Check if user has voted
      if (user.registeredOnChain) {
        const contract = web3Config.getContract();
        const voterInfo = await contract.getVoterInfo(user.walletAddress);

        if (voterInfo.hasVoted) {
          return ResponseFormatter.error(
            res,
            'Cannot delete user who has already voted',
            403
          );
        }
      }

      await prisma.$transaction(async (txPrisma) => {
        await txPrisma.user.delete({
          where: { id: userId }
        });

        await txPrisma.auditLog.create({
          data: {
            action: 'USER_DELETED',
            performedBy: adminEmail,
            performedByRole: 'admin',
            targetId: userId,
            targetType: 'User',
            details: `Admin ${adminEmail} deleted user: ${user.email}`
          }
        });
      });

      console.log('✅ User deleted successfully');

      return ResponseFormatter.success(res, null, 'User deleted successfully');

    } catch (error) {
      console.error('Delete user error:', error);
      next(error);
    }
  }

  /**
   * Get dashboard statistics
   */
  static async getDashboardStats(req, res, next) {
    try {
      // Database stats
      const [
        totalUsers,
        verifiedUsers,
        totalCandidates,
        activeCandidates,
        totalVoteRecords
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isVerified: true } }),
        prisma.candidate.count(),
        prisma.candidate.count({ where: { isActive: true } }),
        prisma.voteRecord.count()
      ]);

      // Blockchain stats
      const contract = web3Config.getContract();
      const [voterCount, candidateCount, votingStatus] = await Promise.all([
        contract.voterCount(),
        contract.candidateCount(),
        contract.getVotingStatus()
      ]);

      // Get vote distribution by prodi
      const votesByProdi = await prisma.voteRecord.groupBy({
        by: ['voterProdi'],
        _count: {
          voterProdi: true
        }
      });

      // Get recent activities
      const recentActivities = await prisma.auditLog.findMany({
        take: 10,
        orderBy: { timestamp: 'desc' },
        select: {
          id: true,
          action: true,
          performedBy: true,
          performedByRole: true,
          details: true,
          timestamp: true
        }
      });

      return ResponseFormatter.success(
        res,
        {
          database: {
            totalUsers,
            verifiedUsers,
            unverifiedUsers: totalUsers - verifiedUsers,
            totalCandidates,
            activeCandidates,
            totalVoteRecords
          },
          blockchain: {
            voterCount: Number(voterCount),
            candidateCount: Number(candidateCount),
            votingActive: votingStatus.active,
            votingStartTime: Number(votingStatus.startTime),
            votingEndTime: Number(votingStatus.endTime)
          },
          voteDistribution: votesByProdi.map(v => ({
            prodi: v.voterProdi,
            votes: v._count.voterProdi
          })),
          recentActivities
        },
        'Dashboard statistics retrieved successfully'
      );

    } catch (error) {
      console.error('Get dashboard stats error:', error);
      next(error);
    }
  }

  /**
   * Get all admins
   */
  static async getAllAdmins(req, res, next) {
    try {
      const admins = await prisma.admin.findMany({
        select: {
          id: true,
          email: true,
          username: true,
          walletAddress: true,
          role: true,
          isActive: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' }
      });

      return ResponseFormatter.success(
        res,
        { admins, total: admins.length },
        'Admins retrieved successfully'
      );

    } catch (error) {
      console.error('Get all admins error:', error);
      next(error);
    }
  }

  /**
   * Create new admin
   */
  static async createAdmin(req, res, next) {
    try {
      const { email, username, password, walletAddress } = req.body;
      const creatorEmail = req.user.email;

      if (!email || !username || !password || !walletAddress) {
        return ResponseFormatter.validationError(res, {
          email: email ? null : 'Email is required',
          username: username ? null : 'Username is required',
          password: password ? null : 'Password is required',
          walletAddress: walletAddress ? null : 'Wallet address is required'
        });
      }

      const existingAdmin = await prisma.admin.findFirst({
        where: {
          OR: [{ email }, { walletAddress }]
        }
      });

      if (existingAdmin) {
        return ResponseFormatter.error(
          res,
          'Admin already exists with this email or wallet address',
          400
        );
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const admin = await prisma.$transaction(async (txPrisma) => {
        const newAdmin = await txPrisma.admin.create({
          data: {
            email,
            username,
            password: hashedPassword,
            walletAddress,
            role: 'admin',
            isActive: true
          }
        });

        await txPrisma.auditLog.create({
          data: {
            action: 'ADMIN_CREATED',
            performedBy: creatorEmail,
            performedByRole: 'admin',
            targetId: newAdmin.id,
            targetType: 'Admin',
            details: `Admin ${creatorEmail} created new admin: ${email}`
          }
        });

        return newAdmin;
      });

      console.log('✅ Admin created successfully');

      return ResponseFormatter.success(
        res,
        {
          id: admin.id,
          email: admin.email,
          username: admin.username,
          walletAddress: admin.walletAddress
        },
        'Admin created successfully',
        201
      );

    } catch (error) {
      console.error('Create admin error:', error);
      next(error);
    }
  }

  /**
   * Get audit logs
   */
  static async getAuditLogs(req, res, next) {
    try {
      const { action, performedBy, page = 1, limit = 20 } = req.query;

      const where = {};
      if (action) where.action = action;
      if (performedBy) where.performedBy = { contains: performedBy };

      const skip = (Number(page) - 1) * Number(limit);

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { timestamp: 'desc' }
        }),
        prisma.auditLog.count({ where })
      ]);

      return ResponseFormatter.success(
        res,
        {
          logs,
          pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            totalPages: Math.ceil(total / Number(limit))
          }
        },
        'Audit logs retrieved successfully'
      );

    } catch (error) {
      console.error('Get audit logs error:', error);
      next(error);
    }
  }

  /**
   * Sync blockchain data to database
   */
  static async syncBlockchainData(req, res, next) {
    try {
      const adminEmail = req.user.email;
      console.log('🔄 Syncing blockchain data...');

      const contract = web3Config.getContract();
      
      // Sync candidates
      const candidateCount = await contract.candidateCount();
      let syncedCandidates = 0;

      for (let i = 1; i <= Number(candidateCount); i++) {
        try {
          const blockchainCandidate = await contract.getCandidate(i);
          
          const candidateData = {
            candidateId: i,
            name: blockchainCandidate.name,
            description: blockchainCandidate.description,
            imageUrl: blockchainCandidate.imageUrl,
            prodi: blockchainCandidate.prodi,
            voteCount: Number(blockchainCandidate.voteCount),
            isActive: blockchainCandidate.isActive,
            dataHash: blockchainCandidate.dataHash
          };

          await prisma.candidate.upsert({
            where: { candidateId: i },
            update: {
              voteCount: candidateData.voteCount,
              isActive: candidateData.isActive
            },
            create: candidateData
          });

          syncedCandidates++;
        } catch (error) {
          console.error(`Error syncing candidate ${i}:`, error.message);
        }
      }

      await prisma.auditLog.create({
        data: {
          action: 'BLOCKCHAIN_SYNC',
          performedBy: adminEmail,
          performedByRole: 'admin',
          details: `Admin ${adminEmail} synced ${syncedCandidates} candidates from blockchain`
        }
      });

      console.log(`✅ Synced ${syncedCandidates} candidates`);

      return ResponseFormatter.success(
        res,
        {
          syncedCandidates,
          totalCandidates: Number(candidateCount)
        },
        'Blockchain data synced successfully'
      );

    } catch (error) {
      console.error('Sync blockchain data error:', error);
      next(error);
    }
  }
}

module.exports = AdminController;
