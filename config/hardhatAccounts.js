const { ethers } = require('ethers');

const MNEMONIC = process.env.HARDHAT_MNEMONIC || "test test test test test test test test test test test junk";
const ACCOUNT_COUNT = parseInt(process.env.HARDHAT_ACCOUNT_COUNT || "10");

let cachedAccounts = null;

function generateAccounts() {
  if (cachedAccounts) {
    return cachedAccounts;
  }

  console.log(`🔑 Generating ${ACCOUNT_COUNT} accounts from mnemonic...`);
  
  const accounts = [];
  
  for (let i = 0; i < ACCOUNT_COUNT; i++) {
    const path = `m/44'/60'/0'/0/${i}`;
    const wallet = ethers.Wallet.fromPhrase(MNEMONIC, path);
    
    accounts.push({
      address: wallet.address,
      privateKey: wallet.privateKey,
      index: i
    });
  }
  
  cachedAccounts = accounts;
  console.log(`✅ Generated ${accounts.length} accounts`);
  
  return accounts;
}

function getPrivateKeyByAddress(address) {
  const accounts = generateAccounts();
  const account = accounts.find(
    acc => acc.address.toLowerCase() === address.toLowerCase()
  );
  return account ? account.privateKey : null;
}

function getAccountInfo(address) {
  const accounts = generateAccounts();
  return accounts.find(
    acc => acc.address.toLowerCase() === address.toLowerCase()
  );
}

function getAllAccounts() {
  return generateAccounts();
}

function getAccountByIndex(index) {
  const accounts = generateAccounts();
  return accounts[index] || null;
}

function isHardhatAccount(address) {
  return getPrivateKeyByAddress(address) !== null;
}

module.exports = {
  accounts: generateAccounts(),
  getPrivateKeyByAddress,
  getAccountInfo,
  getAllAccounts,
  getAccountByIndex,
  isHardhatAccount,
  MNEMONIC
};
