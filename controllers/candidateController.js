const { ethers } = require('ethers');
const prisma = require('../lib/prisma');
const web3Config = require('../config/web3');
const ResponseFormatter = require('../utils/responseFormatter');

class CandidateController {
  /**
   * Add new candidate (Admin only)
   */
  static async addCandidate(req, res, next) {
    try {
      const { candidateId, name, description, imageUrl, prodi } = req.body;
      const adminEmail = req.user.email;

      if (!candidateId || !name || !prodi) {
        return ResponseFormatter.validationError(res, {
          candidateId: candidateId ? null : 'Candidate ID is required',
          name: name ? null : 'Name is required',
          prodi: prodi ? null : 'Program Studi is required'
        });
      }

      // Check if candidate ID already exists
      const existingCandidate = await prisma.candidate.findUnique({
        where: { candidateId: Number(candidateId) }
      });

      if (existingCandidate) {
        return ResponseFormatter.error(res, 'Candidate ID already exists', 400);
      }

      console.log('➕ Adding candidate to blockchain...');

      // Add to blockchain
      const adminWallet = web3Config.getAdminWallet();
      const contract = web3Config.getContractWithSigner(adminWallet);

      const tx = await contract.addCandidate(
        candidateId,
        name,
        description || '',
        imageUrl || '',
        prodi
      );
      const receipt = await tx.wait();

      console.log('✅ Candidate added to blockchain');
      console.log('Transaction Hash:', receipt.hash);

      // Calculate data hash
      const dataHash = ethers.keccak256(
        ethers.toUtf8Bytes(`${candidateId}:${name}:${prodi}`)
      );

      // Save to database
      const candidate = await prisma.$transaction(async (txPrisma) => {
        const newCandidate = await txPrisma.candidate.create({
          data: {
            candidateId: Number(candidateId),
            name,
            description: description || null,
            imageUrl: imageUrl || null,
            prodi,
            voteCount: 0,
            isActive: true,
            dataHash
          }
        });

        await txPrisma.auditLog.create({
          data: {
            action: 'CANDIDATE_ADDED',
            performedBy: adminEmail,
            performedByRole: 'admin',
            targetId: newCandidate.id,
            targetType: 'Candidate',
            details: `Admin ${adminEmail} added candidate: ${name} (ID: ${candidateId})`,
            dataHash: receipt.hash
          }
        });

        return newCandidate;
      });

      return ResponseFormatter.success(
        res,
        {
          candidate,
          transactionHash: receipt.hash,
          blockNumber: receipt.blockNumber
        },
        'Candidate added successfully',
        201
      );

    } catch (error) {
      console.error('Add candidate error:', error);
      
      if (error.message.includes('Candidate already exists')) {
        return ResponseFormatter.error(res, 'Candidate already exists on blockchain', 400);
      }
      
      next(error);
    }
  }

  /**
   * Get all candidates
   */
  static async getAllCandidates(req, res, next) {
    try {
      const { prodi, isActive } = req.query;

      const where = {};
      
      if (prodi) {
        where.prodi = prodi;
      }
      
      if (isActive !== undefined) {
        where.isActive = isActive === 'true';
      }

      const candidates = await prisma.candidate.findMany({
        where,
        orderBy: { candidateId: 'asc' }
      });

      // Sync vote counts from blockchain
      const contract = web3Config.getContract();
      const candidateCount = await contract.candidateCount();

      const syncedCandidates = await Promise.all(
        candidates.map(async (candidate) => {
          try {
            const blockchainCandidate = await contract.getCandidate(candidate.candidateId);
            const blockchainVoteCount = Number(blockchainCandidate.voteCount);

            // Update if different
            if (blockchainVoteCount !== candidate.voteCount) {
              await prisma.candidate.update({
                where: { id: candidate.id },
                data: { voteCount: blockchainVoteCount }
              });
              candidate.voteCount = blockchainVoteCount;
            }
          } catch (error) {
            console.error(`Error syncing candidate ${candidate.candidateId}:`, error.message);
          }

          return candidate;
        })
      );

      return ResponseFormatter.success(
        res,
        {
          candidates: syncedCandidates,
          total: syncedCandidates.length,
          blockchainCandidateCount: Number(candidateCount)
        },
        'Candidates retrieved successfully'
      );

    } catch (error) {
      console.error('Get candidates error:', error);
      next(error);
    }
  }

  /**
   * Get candidate by ID
   */
  static async getCandidateById(req, res, next) {
    try {
      const { candidateId } = req.params;

      const candidate = await prisma.candidate.findUnique({
        where: { candidateId: Number(candidateId) }
      });

      if (!candidate) {
        return ResponseFormatter.error(res, 'Candidate not found', 404);
      }

      // Get from blockchain
      const contract = web3Config.getContract();
      const blockchainCandidate = await contract.getCandidate(candidateId);

      return ResponseFormatter.success(
        res,
        {
          ...candidate,
          blockchain: {
            voteCount: Number(blockchainCandidate.voteCount),
            isActive: blockchainCandidate.isActive,
            createdAt: Number(blockchainCandidate.createdAt)
          }
        },
        'Candidate retrieved successfully'
      );

    } catch (error) {
      console.error('Get candidate error:', error);
      next(error);
    }
  }

  /**
   * Update candidate (Admin only)
   */
  static async updateCandidate(req, res, next) {
    try {
      const { candidateId } = req.params;
      const { name, description, imageUrl, prodi, isActive } = req.body;
      const adminEmail = req.user.email;

      const candidate = await prisma.candidate.findUnique({
        where: { candidateId: Number(candidateId) }
      });

      if (!candidate) {
        return ResponseFormatter.error(res, 'Candidate not found', 404);
      }

      console.log('✏️  Updating candidate...');

      const updatedCandidate = await prisma.$transaction(async (txPrisma) => {
        const updated = await txPrisma.candidate.update({
          where: { candidateId: Number(candidateId) },
          data: {
            name: name || candidate.name,
            description: description !== undefined ? description : candidate.description,
            imageUrl: imageUrl !== undefined ? imageUrl : candidate.imageUrl,
            prodi: prodi || candidate.prodi,
            isActive: isActive !== undefined ? isActive : candidate.isActive
          }
        });

        await txPrisma.auditLog.create({
          data: {
            action: 'CANDIDATE_UPDATED',
            performedBy: adminEmail,
            performedByRole: 'admin',
            targetId: updated.id,
            targetType: 'Candidate',
            details: `Admin ${adminEmail} updated candidate: ${updated.name} (ID: ${candidateId})`
          }
        });

        return updated;
      });

      console.log('✅ Candidate updated successfully');

      return ResponseFormatter.success(
        res,
        { candidate: updatedCandidate },
        'Candidate updated successfully'
      );

    } catch (error) {
      console.error('Update candidate error:', error);
      next(error);
    }
  }

  /**
   * Delete/Deactivate candidate (Admin only)
   */
  static async deleteCandidate(req, res, next) {
    try {
      const { candidateId } = req.params;
      const adminEmail = req.user.email;

      const candidate = await prisma.candidate.findUnique({
        where: { candidateId: Number(candidateId) }
      });

      if (!candidate) {
        return ResponseFormatter.error(res, 'Candidate not found', 404);
      }

      console.log('🗑️  Deactivating candidate...');

      await prisma.$transaction(async (txPrisma) => {
        await txPrisma.candidate.update({
          where: { candidateId: Number(candidateId) },
          data: { isActive: false }
        });

        await txPrisma.auditLog.create({
          data: {
            action: 'CANDIDATE_DEACTIVATED',
            performedBy: adminEmail,
            performedByRole: 'admin',
            targetId: candidate.id,
            targetType: 'Candidate',
            details: `Admin ${adminEmail} deactivated candidate: ${candidate.name} (ID: ${candidateId})`
          }
        });
      });

      console.log('✅ Candidate deactivated successfully');

      return ResponseFormatter.success(
        res,
        null,
        'Candidate deactivated successfully'
      );

    } catch (error) {
      console.error('Delete candidate error:', error);
      next(error);
    }
  }

  /**
   * Get candidates by prodi
   */
  static async getCandidatesByProdi(req, res, next) {
    try {
      const { prodi } = req.params;

      const candidates = await prisma.candidate.findMany({
        where: {
          prodi,
          isActive: true
        },
        orderBy: { candidateId: 'asc' }
      });

      return ResponseFormatter.success(
        res,
        {
          prodi,
          candidates,
          total: candidates.length
        },
        `Candidates for ${prodi} retrieved successfully`
      );

    } catch (error) {
      console.error('Get candidates by prodi error:', error);
      next(error);
    }
  }

  /**
   * Get vote results
   */
  static async getVoteResults(req, res, next) {
    try {
      const { prodi } = req.query;

      const where = { isActive: true };
      if (prodi) {
        where.prodi = prodi;
      }

      const candidates = await prisma.candidate.findMany({
        where,
        orderBy: { voteCount: 'desc' }
      });

      // Sync with blockchain
      const contract = web3Config.getContract();
      const syncedResults = await Promise.all(
        candidates.map(async (candidate) => {
          try {
            const blockchainCandidate = await contract.getCandidate(candidate.candidateId);
            const blockchainVoteCount = Number(blockchainCandidate.voteCount);

            return {
              ...candidate,
              voteCount: blockchainVoteCount
            };
          } catch (error) {
            return candidate;
          }
        })
      );

      // Sort by vote count
      syncedResults.sort((a, b) => b.voteCount - a.voteCount);

      const totalVotes = syncedResults.reduce((sum, c) => sum + c.voteCount, 0);

      return ResponseFormatter.success(
        res,
        {
          candidates: syncedResults,
          totalVotes,
          totalCandidates: syncedResults.length
        },
        'Vote results retrieved successfully'
      );

    } catch (error) {
      console.error('Get vote results error:', error);
      next(error);
    }
  }
}

module.exports = CandidateController;
