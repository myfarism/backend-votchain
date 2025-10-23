const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const cron = require('node-cron');
const prisma = require('./lib/prisma');

// Import routes
const authRoutes = require('./routes/authRoutes');
const voteRoutes = require('./routes/voteRoutes');
const candidateRoutes = require('./routes/candidateRoutes');
const adminRoutes = require('./routes/adminRoutes');
const votingSessionRoutes = require('./routes/votingSessionRoutes');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/vote', voteRoutes);
app.use('/api/candidates', candidateRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/voting-session', votingSessionRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Voting API is running',
    mode: 'Hybrid (PostgreSQL + Blockchain)',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    timestamp: new Date().toISOString()
  });
});

// Cleanup expired OTPs every 30 minutes
cron.schedule('*/30 * * * *', async () => {
  try {
    const result = await prisma.oTP.deleteMany({
      where: {
        expiresAt: { lt: new Date() }
      }
    });
    console.log(`🧹 Cleaned up ${result.count} expired OTPs`);
  } catch (error) {
    console.error('Cleanup error:', error);
  }
});

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log('🚀 ======================================');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`⛓️  Mode: Hybrid (PostgreSQL + Blockchain)`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('🚀 ======================================');
});
