const Channel = artifacts.require('Channel.sol');
const Token = artifacts.require('TestToken.sol');
const receiver = "0x1585936b53834b021f68cc13eeefdec2efc8e724";
const challengePeriod = 1;

module.exports = async(deployer) =>  {
    await deployer.deploy(Token);
    await deployer.deploy(Channel, receiver, Token.address, challengePeriod);
}