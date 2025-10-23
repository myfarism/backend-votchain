const { ethers } = require('ethers');
const contractInfo = require('./contract.json');
const fs = require('fs');
const path = require('path');

class Web3Config {
  constructor() {
    this.provider = null;
    this.contract = null;
    this.abi = null;
  }

  loadABI() {
    if (this.abi) return this.abi;

    try {
      const abiPath = path.join(__dirname, 'VotingContract.abi.json');
      
      if (fs.existsSync(abiPath)) {
        const abiData = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
        
        if (Array.isArray(abiData)) {
          this.abi = abiData;
        } else if (abiData.abi && Array.isArray(abiData.abi)) {
          this.abi = abiData.abi;
        } else {
          throw new Error('Invalid ABI format');
        }
      } else {
        const artifactPath = path.join(__dirname, '../artifacts/contracts/VotingContract.sol/VotingContract.json');
        
        if (fs.existsSync(artifactPath)) {
          const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
          this.abi = artifact.abi;
        } else {
          throw new Error('ABI file not found');
        }
      }

      console.log('✅ ABI loaded successfully');
      return this.abi;

    } catch (error) {
      console.error('❌ Error loading ABI:', error.message);
      throw error;
    }
  }

  getProvider() {
    if (!this.provider) {
      this.provider = new ethers.JsonRpcProvider(
        process.env.RPC_URL || 'http://127.0.0.1:8545'
      );
    }
    return this.provider;
  }

  getContract() {
    if (!this.contract) {
      const provider = this.getProvider();
      const abi = this.loadABI();
      
      this.contract = new ethers.Contract(
        contractInfo.contractAddress,
        abi,
        provider
      );
    }
    return this.contract;
  }

  getContractWithSigner(signer) {
    const abi = this.loadABI();
    
    return new ethers.Contract(
      contractInfo.contractAddress,
      abi,
      signer
    );
  }

  getWallet(privateKey) {
    const provider = this.getProvider();
    return new ethers.Wallet(privateKey, provider);
  }

  getAdminWallet() {
    const provider = this.getProvider();
    return new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);
  }
}

module.exports = new Web3Config();
