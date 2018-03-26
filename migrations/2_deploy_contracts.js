const Factory = artifacts.require('Factory.sol');
const Token = artifacts.require('TestToken.sol');

module.exports = function(deployer) {
       return deployer.deploy(Factory);  
}
