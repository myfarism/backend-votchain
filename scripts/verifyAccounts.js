const { ethers } = require('ethers');
const { getAllAccounts, getPrivateKeyByAddress } = require('../config/hardhatAccounts');

async function verifyAccounts() {
  console.log('🔍 Verifying Hardhat accounts...\n');

  // Get accounts from config
  const accounts = getAllAccounts();

  console.log(`Total accounts: ${accounts.length}\n`);

  // Display first 5 accounts
  console.log('First 5 accounts:');
  for (let i = 0; i < Math.min(5, accounts.length); i++) {
    const acc = accounts[i];
    console.log(`\nAccount #${i}:`);
    console.log(`  Address: ${acc.address}`);
    console.log(`  Private Key: ${acc.privateKey}`);
    
    // Verify private key matches address
    const wallet = new ethers.Wallet(acc.privateKey);
    const verified = wallet.address.toLowerCase() === acc.address.toLowerCase();
    console.log(`  Verified: ${verified ? '✅' : '❌'}`);
  }

  // Test getPrivateKeyByAddress
  console.log('\n🧪 Testing getPrivateKeyByAddress:');
  const testAddress = accounts[0].address;
  const retrievedPK = getPrivateKeyByAddress(testAddress);
  console.log(`Address: ${testAddress}`);
  console.log(`Retrieved PK: ${retrievedPK}`);
  console.log(`Match: ${retrievedPK === accounts[0].privateKey ? '✅' : '❌'}`);

  // Connect to Hardhat node and compare
  console.log('\n🌐 Connecting to Hardhat node...');
  try {
    const provider = new ethers.JsonRpcProvider('http://98.91.32.88:8545');
    const hardhatAccounts = await provider.listAccounts();
    
    console.log(`Hardhat node accounts: ${hardhatAccounts.length}`);
    
    // Compare first account
    const hardhatAddr = typeof hardhatAccounts[0] === 'string' 
      ? hardhatAccounts[0] 
      : hardhatAccounts[0].address;
    
    const configAddr = accounts[0].address;
    
    console.log(`\nHardhat Account #0: ${hardhatAddr}`);
    console.log(`Config Account #0: ${configAddr}`);
    console.log(`Match: ${hardhatAddr.toLowerCase() === configAddr.toLowerCase() ? '✅' : '❌'}`);
    
  } catch (error) {
    console.log('⚠️  Could not connect to Hardhat node:', error.message);
    console.log('   Make sure Hardhat node is running: npx hardhat node');
  }

  console.log('\n✅ Verification complete!');
}

verifyAccounts()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
