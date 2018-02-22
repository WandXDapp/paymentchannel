const ethers = require('ethers');
const utils = ethers.utils;
const ethUtil = require('ethereumjs-util');

function web3StringToBytes32(text) {
  var result = ethers.utils.hexlify(ethers.utils.toUtf8Bytes(text));
  while (result.length < 66) { result += '0'; }
  if (result.length !== 66) { throw new Error("invalid web3 implicit bytes32"); }
  return result;
}

function signData(receiverAddress, balance, contractAddress, pk) {
// let nonce = 1;//Number(Math.random().toString().slice(2));
  // let nonce = 1;
  let packedData = utils.solidityKeccak256(
      [ "address", "uint256", "address"],
      [ receiverAddress, balance, contractAddress]
    ).slice(2);
  packedData = new Buffer(packedData, 'hex');
  packedData = Buffer.concat([
    new Buffer(`\x19Ethereum Signed Message:\n${packedData.length.toString()}`),
    packedData]);
  packedData = web3.sha3(`0x${packedData.toString('hex')}`, { encoding: 'hex' });
  return ethUtil.ecsign(
    new Buffer(packedData.slice(2), 'hex'),
    new Buffer(pk, 'hex'));
}

module.exports = {
  web3StringToBytes32, signData
}