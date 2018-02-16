const Factory = artifacts.require('Factory.sol');
const Token = artifacts.require('TestToken.sol');
const receiver = "0x1585936b53834b021f68cc13eeefdec2efc8e724";
const challengePeriod = 1;

module.exports = function(deployer) {
    return deployer.deploy(Token).then(() => {
       return deployer.deploy(Factory);
    });
   
}