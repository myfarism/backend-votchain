const { ethers } = require('ethers');

class SignatureHelper {
  static createVoteMessageHash(voterAddress, candidateId, timestamp) {
    const message = `${voterAddress}:${candidateId}:${timestamp}`;
    return ethers.keccak256(ethers.toUtf8Bytes(message));
  }

  static async signMessageHash(messageHash, privateKey, provider) {
    const wallet = new ethers.Wallet(privateKey, provider);
    const messageHashBytes = ethers.getBytes(messageHash);
    const signature = await wallet.signMessage(messageHashBytes);
    return signature;
  }

  static verifySignature(messageHash, signature, expectedAddress) {
    try {
      const messageHashBytes = ethers.getBytes(messageHash);
      const recoveredAddress = ethers.verifyMessage(messageHashBytes, signature);
      return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }
}

module.exports = SignatureHelper;
