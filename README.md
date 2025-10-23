# 🗳️ Blockchain Voting System

<div align="center">








**Sistem voting berbasis blockchain yang aman, transparan, dan terdesentralisasi dengan ECDSA signature verification**

[Features](#-features) -  [Architecture](#-architecture) -  [Quick Start](#-quick-start) -  [API Documentation](#-api-documentation) -  [Contributing](#-contributing)

</div>

***

## 🌟 Features

### 🔐 **Security & Transparency**
- ✅ **ECDSA Signature Verification** - Setiap vote diverifikasi dengan kriptografi digital
- ✅ **Anti-Replay Attack** - Message hash tracking untuk mencegah serangan replay
- ✅ **Immutable Records** - Data voting tersimpan permanen di blockchain
- ✅ **Audit Trail** - Setiap aktivitas tercatat dalam audit log

### 👥 **User Management**
- 👤 **Dual Role System** - User (Voter) dan Admin dengan permission terpisah
- 📧 **OTP Email Verification** - Verifikasi email 2-faktor sebelum registrasi blockchain
- 🔑 **JWT Authentication** - Secure token-based authentication
- 🔒 **Password Reset** - Forgot password dengan email token

### 🗳️ **Voting Features**
- ⛓️ **On-Chain Voting** - Vote langsung tersimpan di blockchain
- 🎓 **Prodi-Based Voting** - Voter hanya bisa vote untuk kandidat di prodi mereka
- ⏰ **Timed Sessions** - Voting session dengan start & end time
- 📊 **Real-time Results** - Hasil voting real-time dari blockchain

### 🎯 **Candidate Management**
- ➕ Add, Edit, Delete candidates (Admin only)
- 🏷️ Kategori berdasarkan Program Studi (Prodi)
- 📸 Support image URL untuk foto kandidat
- 📝 Visi & Misi kandidat

### 📈 **Dashboard & Analytics**
- 📊 Statistik real-time (total voters, votes, candidates)
- 📉 Vote distribution by Prodi
- 🔍 Blockchain data synchronization
- 📜 Comprehensive audit logs

***

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                            │
│                    (React / Next.js)                        │
└────────────────────────┬────────────────────────────────────┘
                         │ REST API
┌────────────────────────▼────────────────────────────────────┐
│                    Express Backend                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Auth         │  │ Vote         │  │ Candidate    │     │
│  │ Controller   │  │ Controller   │  │ Controller   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │ Admin        │  │ Session      │                        │
│  │ Controller   │  │ Controller   │                        │
│  └──────────────┘  └──────────────┘                        │
└────────┬──────────────────────────────────┬────────────────┘
         │                                   │
         │ Prisma ORM                        │ Ethers.js
         │                                   │
┌────────▼────────────┐            ┌────────▼────────────────┐
│   PostgreSQL        │            │   Ethereum Network      │
│   Database          │            │   (Hardhat Local)       │
│                     │            │                         │
│  • Users            │            │  • VotingContract.sol   │
│  • Candidates       │            │  • Voters               │
│  • Vote Records     │            │  • Candidates           │
│  • Audit Logs       │            │  • Votes                │
│  • Sessions         │            │  • Signatures           │
└─────────────────────┘            └─────────────────────────┘
```

**Hybrid Approach:**
- 🗄️ **Database (PostgreSQL)**: User credentials, OTP, candidate details, audit logs
- ⛓️ **Blockchain**: Voter registration, vote casting, voting results (immutable)

***

## 🚀 Quick Start

### Prerequisites

- Node.js v18+ 
- PostgreSQL 14+
- npm or yarn
- Hardhat (for local blockchain)

### 1️⃣ Clone Repository

```bash
git clone https://github.com/yourusername/blockchain-voting-system.git
cd blockchain-voting-system
```

### 2️⃣ Install Dependencies

```bash
npm install
```

### 3️⃣ Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```env
# Server
PORT=5000
NODE_ENV=development

# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/voting_system"

# JWT
JWT_SECRET=your_super_secret_jwt_key_min_32_chars

# Email
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password

# Blockchain
RPC_URL=http://127.0.0.1:8545
ADMIN_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Frontend
FRONTEND_URL=http://localhost:3000
```

### 4️⃣ Setup Database

```bash
# Generate Prisma Client
npm run prisma:generate

# Push schema to database
npm run prisma:push

# Seed initial data (Admin account)
npm run prisma:seed
```

**Default Admin Credentials:**
- Email: `admin@voting.com`
- Password: `admin123`
- Wallet: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`

### 5️⃣ Start Hardhat Local Blockchain

```bash
# In separate terminal
cd hardhat-project
npx hardhat node
```

### 6️⃣ Deploy Smart Contract

```bash
npx hardhat run scripts/deploy.js --network localhost
```

Copy contract address to `config/contract.json`:
```json
{
  "contractAddress": "0x5FbDB2315678afecb367f032d93F642f64180aa3"
}
```

### 7️⃣ Start Backend Server

```bash
npm run dev
```

Server running at: `http://localhost:5000`

***

## 📚 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication Endpoints

#### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "email": "student@university.ac.id",
  "username": "student1",
  "nim": "2021001",
  "prodi": "Teknik Informatika",
  "password": "password123"
}
```

#### Verify OTP
```http
POST /auth/verify-otp
Content-Type: application/json

{
  "email": "student@university.ac.id",
  "otp": "123456"
}
```

#### User Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "student@university.ac.id",
  "password": "password123"
}
```

#### Admin Login
```http
POST /auth/login/admin
Content-Type: application/json

{
  "email": "admin@voting.com",
  "password": "admin123"
}
```

### Voting Endpoints

#### Cast Vote
```http
POST /vote/cast
Authorization: Bearer <token>
Content-Type: application/json

{
  "candidateId": 1,
  "voterPrivateKey": "0x..."
}
```

#### Get Voting Status
```http
GET /vote/voting-status
Authorization: Bearer <token>
```

#### Get Vote History
```http
GET /vote/my-history
Authorization: Bearer <token>
```

### Candidate Endpoints

#### Get All Candidates
```http
GET /candidates?prodi=Teknik%20Informatika
Authorization: Bearer <token>
```

#### Add Candidate (Admin)
```http
POST /candidates
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "candidateId": 1,
  "name": "Candidate Name",
  "description": "Vision and Mission",
  "imageUrl": "https://example.com/photo.jpg",
  "prodi": "Teknik Informatika"
}
```

#### Get Vote Results
```http
GET /candidates/results?prodi=Teknik%20Informatika
Authorization: Bearer <token>
```

### Admin Endpoints

#### Dashboard Statistics
```http
GET /admin/dashboard
Authorization: Bearer <admin-token>
```

#### Get All Users
```http
GET /admin/users?page=1&limit=10&prodi=Teknik%20Informatika
Authorization: Bearer <admin-token>
```

#### Audit Logs
```http
GET /admin/audit-logs?page=1&limit=20
Authorization: Bearer <admin-token>
```

#### Sync Blockchain Data
```http
POST /admin/sync-blockchain
Authorization: Bearer <admin-token>
```

### Voting Session Endpoints

#### Start Voting Session (Admin)
```http
POST /voting-session/start
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "sessionName": "Pemilihan BEM 2025",
  "description": "Pemilihan Ketua BEM periode 2025-2026",
  "durationInHours": 24
}
```

#### End Voting Session (Admin)
```http
POST /voting-session/end
Authorization: Bearer <admin-token>
```

#### Get Current Session
```http
GET /voting-session/current
Authorization: Bearer <token>
```

***

## 🗂️ Project Structure

```
blockchain-voting-system/
├── config/
│   ├── contract.json          # Smart contract address
│   ├── VotingContract.json    # Contract ABI
│   └── web3.js                # Web3 configuration
├── controllers/
│   ├── authController.js      # Authentication logic
│   ├── voteController.js      # Voting logic
│   ├── candidateController.js # Candidate management
│   ├── adminController.js     # Admin operations
│   └── votingSessionController.js # Session management
├── middleware/
│   └── authMiddleware.js      # JWT & role verification
├── routes/
│   ├── authRoutes.js
│   ├── voteRoutes.js
│   ├── candidateRoutes.js
│   ├── adminRoutes.js
│   └── votingSessionRoutes.js
├── utils/
│   ├── responseFormatter.js   # API response formatter
│   └── signatureHelper.js     # ECDSA signature utilities
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.js                # Database seeder
├── lib/
│   └── prisma.js              # Prisma client
├── contracts/
│   └── VotingContract.sol     # Smart contract
├── .env                       # Environment variables
├── server.js                  # Main server file
└── package.json
```

***

## 🔒 Security Features

### 1. **ECDSA Signature Verification**
Setiap vote menggunakan kriptografi ECDSA untuk memastikan:
- Vote berasal dari voter yang sah
- Tidak bisa dipalsukan
- Dapat diverifikasi secara publik

```javascript
// Signature creation
const messageHash = SignatureHelper.createVoteMessageHash(
  voterAddress, 
  candidateId, 
  timestamp
);
const signature = await wallet.signMessage(messageHash);

// On-chain verification
contract.vote(candidateId, messageHash, signature);
```

### 2. **Anti-Replay Attack**
Message hash tracking mencegah vote yang sama dikirim berulang kali:

```solidity
mapping(bytes32 => bool) public usedMessageHashes;

modifier noReplayAttack(bytes32 _messageHash) {
    require(!usedMessageHashes[_messageHash], "Message hash already used");
    _;
}
```

### 3. **Role-Based Access Control**
- **User**: Hanya bisa vote dan melihat profil
- **Admin**: Full access ke management system

### 4. **Data Integrity**
- Smart contract menyimpan hash data untuk verifikasi integritas
- Audit logs mencatat semua aktivitas admin

***

## 📊 Database Schema

```prisma
model User {
  id                   String    @id @default(uuid())
  email                String    @unique
  username             String
  nim                  String    @unique
  prodi                String
  password             String
  walletAddress        String    @unique
  isVerified           Boolean   @default(false)
  registeredOnChain    Boolean   @default(false)
  // ... other fields
}

model Candidate {
  id              String   @id @default(uuid())
  candidateId     Int      @unique
  name            String
  description     String?
  imageUrl        String?
  prodi           String
  voteCount       Int      @default(0)
  isActive        Boolean  @default(true)
  // ... other fields
}

model VoteRecord {
  id              String   @id @default(uuid())
  voterAddress    String
  candidateId     Int
  messageHash     String
  signature       String
  verified        Boolean
  transactionHash String?  @unique
  // ... other fields
}
```

***

## 🧪 Testing

### Run Tests
```bash
npm test
```

### Test Scenarios
- ✅ User registration & OTP verification
- ✅ Vote casting with signature
- ✅ Candidate management (CRUD)
- ✅ Voting session lifecycle
- ✅ Admin operations

### Test with Postman
Import Postman collection:
```bash
docs/postman_collection.json
```

***

## 🎯 Roadmap

- [x] Basic voting functionality
- [x] ECDSA signature verification
- [x] Admin dashboard
- [x] Audit logging
- [ ] Frontend React application
- [ ] Vote delegation feature
- [ ] Multi-language support
- [ ] Mobile app (React Native)
- [ ] IPFS integration for candidate photos
- [ ] Real-time notifications (WebSocket)

***

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

***

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

***

## 👨‍💻 Authors

- **Your Name** - *Initial work* - [YourGitHub](https://github.com/yourusername)

***

## 🙏 Acknowledgments

- [Ethereum](https://ethereum.org/) - Blockchain platform
- [Hardhat](https://hardhat.org/) - Ethereum development environment
- [Prisma](https://www.prisma.io/) - Next-generation ORM
- [Express.js](https://expressjs.com/) - Web framework
- [OpenZeppelin](https://openzeppelin.com/) - Secure smart contract library

***

## 📧 Contact

For questions or support, please contact:
- Email: your.email@example.com
- Twitter: [@yourhandle](https://twitter.com/yourhandle)
- LinkedIn: [Your Name](https://linkedin.com/in/yourname)

***

<div align="center">

**Made with ❤️ using Blockchain Technology**

⭐ Star this repo if you find it useful!

</div>