const Factory = artifacts.require('Factory.sol');
const TestToken = artifacts.require('TestToken.sol');
const TestFactory = artifacts.require('Factory_Test.sol');
const BigNumber = require('bignumber.js');
const Web3 = require('web3');
const Utils = require('./helpers/utils');
const time = require('./helpers/time');

var web3 = new Web3(Web3.givenProvider);

contract('Factory', (accounts) => {
    
    let receiver;
    let sender;
    let testAddress1;
    let testAddress2;    

    beforeEach(async() => {
        sender = accounts[0];
        receiver = accounts[1];
        testAddress1 = accounts[2];
        testAddress2 = accounts[3];        
    });

    describe('Constructor', async () =>{

        it("Verify constructors", async()=>{
            let factory = await Factory.new({from:sender});
            assert.strictEqual(await factory.owner(), sender); 
        });
    });

    describe('createChannel', async () => { 
        it("createChannel : New channel will be created", async()=>{
            let Token = await TestToken.new({from: sender});
            let challengePeriod = 500;
            let factory = await Factory.new({from: sender});
            let channel = await factory.createChannel(receiver, Token.address, challengePeriod, {from: sender});
            let channelAddress = channel.logs[0].args._channelAddress;
            let channelDetails = await factory.getInfo(channelAddress);
            let users = await factory.getChannelUsers(channelAddress);       
            assert.strictEqual( users[0], sender);
            assert.strictEqual( users[1], receiver);
            assert.strictEqual(channelDetails[0], sender); 
            assert.strictEqual(channelDetails[1], receiver);
            assert.strictEqual(channelDetails[2], Token.address);
            assert.strictEqual(new BigNumber(channelDetails[3]).toNumber(), challengePeriod); 
            assert.strictEqual(new BigNumber(channelDetails[5]).toNumber(), 0); //status : 0 = Initiated
        });


        it("createChannel : with invalid receiver address (should fail)", async()=>{
            let Token = await TestToken.new({from: sender});
            let challengePeriod = 500;
            let factory = await Factory.new({from: sender});
            try{
                await factory.createChannel(0, Token.address, challengePeriod, {from: sender});
            }catch(error){
                //console.log(error);
                Utils.ensureException(error);
            }        
        });

        it("createChannel : with same sender & receiver address (should fail)", async()=>{
            let Token = await TestToken.new({from: sender});
            let challengePeriod = 500;
            let factory = await Factory.new({from: sender});
            try{
                await factory.createChannel(sender, Token.address, challengePeriod, {from: sender});
            }catch(error){
                //console.log(error);
                Utils.ensureException(error);
            }        
        });

        it("createChannel : with non-contract token address (should fail)", async()=>{
            let challengePeriod = 500;
            let factory = await Factory.new({from: sender});
            try{
                await factory.createChannel(receiver, testAddress1, challengePeriod, {from: sender});
            }catch(error){
                //console.log(error);
                Utils.ensureException(error);
            }        
        });

        it("createChannel : with no challenge Period (should fail)", async()=>{
            let Token = await TestToken.new({from: sender});
            let challengePeriod = 0;
            let factory = await Factory.new({from: sender});
            try{
                await factory.createChannel(receiver, Token.address, challengePeriod, {from: sender});
            }catch(error){
                //console.log(error);
                Utils.ensureException(error);
            }        
        });
    });

    describe('rechargeChannel', async() => {    

        it("rechargeChannel : Approved tokens will be transferred to channel", async()=>{
            let Token = await TestToken.new({from: sender});
            let challengePeriod = 500;
            let factory = await Factory.new({from: sender});
            let channel = await factory.createChannel(receiver, Token.address, challengePeriod,{from: sender});
            let channelAddress = channel.logs[0].args._channelAddress;
            await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: sender});
            assert.strictEqual(new BigNumber(await Token.allowance(accounts[0], channelAddress)).toNumber(), 
                                new BigNumber(1000).times(new BigNumber(10).pow(18)).toNumber());
            let tokenAmount = 500;
            await factory.rechargeChannel(channelAddress, new BigNumber(tokenAmount).times(new BigNumber(10).pow(18)), {from: sender}); 
            assert.strictEqual((await Token.balanceOf(channelAddress)).dividedBy(new BigNumber(10).pow(18)).toNumber(), tokenAmount);
            
            let channelDetails = await factory.getInfo(channelAddress);        
            assert.strictEqual(new BigNumber(channelDetails[6]).dividedBy(new BigNumber(10).pow(18)).toNumber(), tokenAmount);
            assert.strictEqual(new BigNumber(channelDetails[5]).toNumber(), 1); //status : 1 = Recharged
        });

        it("rechargeChannel : twice before withdrawal by receiver", async()=>{
            let Token = await TestToken.new({from: sender});
            let challengePeriod = 500;
            let factory = await Factory.new({from: sender});
            let channel = await factory.createChannel(receiver, Token.address, challengePeriod,{from: sender});
            let channelAddress = channel.logs[0].args._channelAddress;
            await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: sender});
            assert.strictEqual(new BigNumber(await Token.allowance(accounts[0], channelAddress)).toNumber(), 
                                new BigNumber(1000).times(new BigNumber(10).pow(18)).toNumber());
            let tokenAmount = 500;
            await factory.rechargeChannel(channelAddress, new BigNumber(tokenAmount).times(new BigNumber(10).pow(18)), {from: sender}); 
            assert.strictEqual((await Token.balanceOf(channelAddress)).dividedBy(new BigNumber(10).pow(18)).toNumber(), tokenAmount);
            
            let channelDetails = await factory.getInfo(channelAddress);
            assert.strictEqual(new BigNumber(channelDetails[6]).dividedBy(new BigNumber(10).pow(18)).toNumber(), tokenAmount);
            assert.strictEqual(new BigNumber(channelDetails[5]).toNumber(), 1); //status : 1 = Recharged
            // Recharging with remaining 500 approved tokens
            await factory.rechargeChannel(channelAddress, new BigNumber(tokenAmount).times(new BigNumber(10).pow(18)), {from: sender}); 
            assert.strictEqual((await Token.balanceOf(channelAddress)).dividedBy(new BigNumber(10).pow(18)).toNumber(), tokenAmount*2);
            
            let channelDetails2 = await factory.getInfo(channelAddress);                   
            assert.strictEqual(new BigNumber(channelDetails2[6]).dividedBy(new BigNumber(10).pow(18)).toNumber(), tokenAmount*2);
            assert.strictEqual(new BigNumber(channelDetails2[5]).toNumber(), 1); //status : 1 = Recharged
        });

        it("rechargeChannel : with non-contract channel address (should fail)", async()=>{
            let Token = await TestToken.new({from: sender});
            let challengePeriod = 500;
            let factory = await Factory.new({from: sender});
            let channel = await factory.createChannel(receiver, Token.address, challengePeriod, {from: sender});
            let channelAddress = channel.logs[0].args._channelAddress;
            await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: sender});
            try{
                await factory.rechargeChannel(testAddress1, new BigNumber(500).times(new BigNumber(10).pow(18)),{from: sender});      
            }catch(error){
                //console.log(error);
                Utils.ensureException(error);
            }
        });

        it("rechargeChannel : with zero deposit (should fail)", async()=>{
            let Token = await TestToken.new({from: sender});
            let challengePeriod = 500;
            let factory = await Factory.new({from: sender});
            let channel = await factory.createChannel(receiver, Token.address, challengePeriod, {from: sender});
            let channelAddress = channel.logs[0].args._channelAddress;
            await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: sender});
            try{
                await factory.rechargeChannel(channelAddress, 0, {from: sender}); 
            }catch(error){
                //console.log(error);
                Utils.ensureException(error);
            }        
        });

        it("rechargeChannel : with origin as non-sender address (should fail)", async()=>{
            let Token = await TestToken.new({from: sender});
            let challengePeriod = 500;
            let factory = await Factory.new({from: sender});
            let channel = await factory.createChannel(receiver, Token.address, challengePeriod, {from: sender});
            let channelAddress = channel.logs[0].args._channelAddress;
            await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)),{from: sender});
            try{
                await factory.rechargeChannel(channelAddress, 500, {from: testAddress1}); 
            }catch(error){
                //console.log(error);
                Utils.ensureException(error);
            }        
        });

        it("rechargeChannel : without approving tokens (should fail)", async()=>{
            let Token = await TestToken.new({from: sender});
            let challengePeriod = 500;
            let factory = await Factory.new({from: sender});
            let channel = await factory.createChannel(receiver, Token.address, challengePeriod, {from: sender});
            let channelAddress = channel.logs[0].args._channelAddress;
            try{
                await factory.rechargeChannel(channelAddress, new BigNumber(500).times(new BigNumber(10).pow(18)),{from: sender}); 
            }catch(error){
                //console.log(error);
                Utils.ensureException(error);
            }        
        });

        it("rechargeChannel : more than approved tokens (should fail)", async()=>{
            let Token = await TestToken.new({from: sender});
            let challengePeriod = 500;
            let factory = await Factory.new({from: sender});
            let channel = await factory.createChannel(receiver, Token.address, challengePeriod, {from: sender});
            let channelAddress = channel.logs[0].args._channelAddress;
            await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)),{from: sender});
            try{
                await factory.rechargeChannel(channelAddress, new BigNumber(1001).times(new BigNumber(10).pow(18)),{from: sender}); 
            }catch(error){
                //console.log(error);
                Utils.ensureException(error);
            }        
        });
    });
    describe("withdrawFromChannel", async() => {

    
        it("withdrawFromChannel : tokens will be transferred to receiver account", async()=>{
            let Token = await TestToken.new({from: sender});
            let challengePeriod = 400;
            // Test contract will be used as testrpc add prefix while signing
            let factory = await TestFactory.new({from: sender});
            let channel = await factory.createChannel(receiver, Token.address, challengePeriod, {from: sender}); 
            let channelAddress = channel.logs[0].args._channelAddress;
            
            await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: sender});
            await factory.rechargeChannel(channelAddress, new BigNumber(500).times(new BigNumber(10).pow(18)), {from: sender});  
            assert.strictEqual((await Token.balanceOf(channelAddress)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 500);
            let balance = new BigNumber(100).times(new BigNumber(10).pow(18))
            let hash = web3.utils.soliditySha3(receiver, balance, channelAddress);
            let sig = await web3.eth.sign(hash, sender);
            sig = sig.substr(2, sig.length);
            let r = '0x' + sig.substr(0, 64);
            let s = '0x' + sig.substr(64, 64);
            let v = web3.utils.toDecimal(sig.substr(128, 2)) + 27;
            await factory.withdrawFromChannel(channelAddress, balance, v,r,s, {from: receiver});     
            assert.strictEqual((await Token.balanceOf(receiver)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 100);
            let channelDetails = await factory.getInfo(channelAddress);        
            assert.strictEqual(new BigNumber(channelDetails[7]).dividedBy(new BigNumber(10).pow(18)).toNumber(), 100);
            assert.strictEqual(new BigNumber(channelDetails[5]).toNumber(), 2); //status : 2 = Withdrawn
        });

        it("withdrawFromChannel : withdrawing 100 tokens twice", async()=>{
            let Token = await TestToken.new({from: sender});
            let challengePeriod = 400;
            // Test contract will be used as testrpc add prefix while signing
            let factory = await TestFactory.new({from: sender});
            let channel = await factory.createChannel(receiver, Token.address, challengePeriod, {from: sender}); 
            let channelAddress = channel.logs[0].args._channelAddress;
            
            await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: sender});
            await factory.rechargeChannel(channelAddress, new BigNumber(500).times(new BigNumber(10).pow(18)), {from: sender});  
            assert.strictEqual((await Token.balanceOf(channelAddress)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 500);
            let balance = new BigNumber(100).times(new BigNumber(10).pow(18))
            let hash = web3.utils.soliditySha3(receiver, balance, channelAddress);
            let sig = await web3.eth.sign(hash, sender);
            sig = sig.substr(2, sig.length);
            let r = '0x' + sig.substr(0, 64);
            let s = '0x' + sig.substr(64, 64);
            let v = web3.utils.toDecimal(sig.substr(128, 2)) + 27;
            await factory.withdrawFromChannel(channelAddress, balance, v,r,s, {from: receiver});     
            assert.strictEqual((await Token.balanceOf(receiver)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 100);
            let channelDetails = await factory.getInfo(channelAddress);        
            assert.strictEqual(new BigNumber(channelDetails[7]).dividedBy(new BigNumber(10).pow(18)).toNumber(), 100);
            assert.strictEqual(new BigNumber(channelDetails[5]).toNumber(), 2); //status : 2 = Withdrawn
            try{
                //trying to withdraw again using same signed hash
                await factory.withdrawFromChannel(channelAddress, balance, v, r, s, {from: receiver});
            }catch(error){
                //console.log(error);
                Utils.ensureException(error);
            }
            
        });

        it("withdrawFromChannel : with non-contract channel address (should fail)", async()=>{
            let Token = await TestToken.new({from: sender});
            let challengePeriod = 400;
            // Test contract will be used as testrpc add prefix while signing
            let factory = await TestFactory.new({from: sender});
            let channel = await factory.createChannel(receiver, Token.address, challengePeriod, {from: sender}); 
            let channelAddress = channel.logs[0].args._channelAddress;
            
            await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: sender});
            await factory.rechargeChannel(channelAddress, new BigNumber(500).times(new BigNumber(10).pow(18)), {from: sender});  
            assert.strictEqual((await Token.balanceOf(channelAddress)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 500);
            let balance = new BigNumber(100).times(new BigNumber(10).pow(18))
            let hash = web3.utils.soliditySha3(receiver, balance, channelAddress);
            let sig = await web3.eth.sign(hash, sender);
            sig = sig.substr(2, sig.length);
            let r = '0x' + sig.substr(0, 64);
            let s = '0x' + sig.substr(64, 64);
            let v = web3.utils.toDecimal(sig.substr(128, 2)) + 27;
            try{
                await factory.withdrawFromChannel(testAddress1, balance, v, r, s, {from: receiver});      
            }catch(error){
                //console.log(error);
                Utils.ensureException(error);
            }
        });

        it("withdrawFromChannel : with zero deposit (should fail)", async()=>{
            let Token = await TestToken.new({from: sender});
            let challengePeriod = 400;
            // Test contract will be used as testrpc add prefix while signing
            let factory = await TestFactory.new({from: sender});
            let channel = await factory.createChannel(receiver, Token.address, challengePeriod, {from: sender}); 
            let channelAddress = channel.logs[0].args._channelAddress;
            
            await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: sender});
            await factory.rechargeChannel(channelAddress, new BigNumber(500).times(new BigNumber(10).pow(18)), {from: sender});  
            assert.strictEqual((await Token.balanceOf(channelAddress)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 500);
            let balance = new BigNumber(0).times(new BigNumber(10).pow(18))
            let hash = web3.utils.soliditySha3(receiver, balance, channelAddress);
            let sig = await web3.eth.sign(hash, sender);
            sig = sig.substr(2, sig.length);
            let r = '0x' + sig.substr(0, 64);
            let s = '0x' + sig.substr(64, 64);
            let v = web3.utils.toDecimal(sig.substr(128, 2)) + 27;
            try{
                await factory.withdrawFromChannel(channelAddress, balance, v, r, s, {from: receiver});      
            }catch(error){
                //console.log(error);
                Utils.ensureException(error);
            }
        });

        it("withdrawFromChannel : with a non-receiver address (should fail)", async()=>{
            let Token = await TestToken.new({from: sender});
            let challengePeriod = 400;
            // Test contract will be used as testrpc add prefix while signing
            let factory = await TestFactory.new({from: sender});
            let channel = await factory.createChannel(receiver, Token.address, challengePeriod, {from: sender}); 
            let channelAddress = channel.logs[0].args._channelAddress;
            
            await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: sender});
            await factory.rechargeChannel(channelAddress, new BigNumber(500).times(new BigNumber(10).pow(18)), {from: sender});  
            assert.strictEqual((await Token.balanceOf(channelAddress)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 500);
            let balance = new BigNumber(100).times(new BigNumber(10).pow(18))
            let hash = web3.utils.soliditySha3(receiver, balance, channelAddress);
            let sig = await web3.eth.sign(hash, sender);
            sig = sig.substr(2, sig.length);
            let r = '0x' + sig.substr(0, 64);
            let s = '0x' + sig.substr(64, 64);
            let v = web3.utils.toDecimal(sig.substr(128, 2)) + 27;
            try{
                await factory.withdrawFromChannel(channelAddress, balance, v, r, s, {from: testAddress1});      
            }catch(error){
                //console.log(error);
                Utils.ensureException(error);
            }
        });

        it("withdrawFromChannel : without recharging the channel (should fail)", async()=>{
            let Token = await TestToken.new({from: sender});
            let challengePeriod = 400;
            // Test contract will be used as testrpc add prefix while signing
            let factory = await TestFactory.new({from: sender});
            let channel = await factory.createChannel(receiver, Token.address, challengePeriod, {from: sender}); 
            let channelAddress = channel.logs[0].args._channelAddress;
            
            let balance = new BigNumber(100).times(new BigNumber(10).pow(18))
            let hash = web3.utils.soliditySha3(receiver, balance, channelAddress);
            let sig = await web3.eth.sign(hash, sender);
            sig = sig.substr(2, sig.length);
            let r = '0x' + sig.substr(0, 64);
            let s = '0x' + sig.substr(64, 64);
            let v = web3.utils.toDecimal(sig.substr(128, 2)) + 27;
            try{
                await factory.withdrawFromChannel(channelAddress, balance, v, r, s, {from: receiver});      
            }catch(error){
                //console.log(error);
                Utils.ensureException(error);
            }
        });


        it("withdrawFromChannel : withdraw more than deposit(should fail)", async()=>{
            let Token = await TestToken.new({from: sender});
            let challengePeriod = 400;
            // Test contract will be used as testrpc add prefix while signing
            let factory = await TestFactory.new({from: sender});
            let channel = await factory.createChannel(receiver, Token.address, challengePeriod, {from: sender}); 
            let channelAddress = channel.logs[0].args._channelAddress;
            
            await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: sender});
            await factory.rechargeChannel(channelAddress, new BigNumber(500).times(new BigNumber(10).pow(18)), {from: sender});  
            assert.strictEqual((await Token.balanceOf(channelAddress)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 500);
            let balance = new BigNumber(501).times(new BigNumber(10).pow(18)); //501>500
            let hash = web3.utils.soliditySha3(receiver, balance, channelAddress);
            let sig = await web3.eth.sign(hash, sender);
            sig = sig.substr(2, sig.length);
            let r = '0x' + sig.substr(0, 64);
            let s = '0x' + sig.substr(64, 64);
            let v = web3.utils.toDecimal(sig.substr(128, 2)) + 27;
            try{
                await factory.withdrawFromChannel(channelAddress, balance, v, r, s, {from: receiver});      
            }catch(error){
                //console.log(error);
                Utils.ensureException(error);
            }
        });


        it("withdrawFromChannel : signature signed with non-sender address (should fail)", async()=>{
            let Token = await TestToken.new({from: sender});
            let challengePeriod = 400;
            // Test contract will be used as testrpc add prefix while signing
            let factory = await TestFactory.new({from: sender});
            let channel = await factory.createChannel(receiver, Token.address, challengePeriod, {from: sender}); 
            let channelAddress = channel.logs[0].args._channelAddress;
            
            await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: sender});
            await factory.rechargeChannel(channelAddress, new BigNumber(500).times(new BigNumber(10).pow(18)), {from: sender});  
            assert.strictEqual((await Token.balanceOf(channelAddress)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 500);
            let balance = new BigNumber(100).times(new BigNumber(10).pow(18)); 
            let hash = web3.utils.soliditySha3(receiver, balance, channelAddress);
            let sig = await web3.eth.sign(hash, accounts[2]); // accounts[2] is not sender
            sig = sig.substr(2, sig.length);
            let r = '0x' + sig.substr(0, 64);
            let s = '0x' + sig.substr(64, 64);
            let v = web3.utils.toDecimal(sig.substr(128, 2)) + 27;
            try{
                await factory.withdrawFromChannel(channelAddress, balance, v, r, s, {from: receiver});      
            }catch(error){
                //console.log(error);
                Utils.ensureException(error);
            }
        });

});

    describe("channelMutualSettlement", async() => {

    
        it("channelMutualSettlement : Tokens will be transferred respectively (By Receiver)", async()=>{
            let Token = await TestToken.new({from: sender});
            let challengePeriod = 400;
            // Test contract will be used as testrpc add prefix while signing
            let factory = await TestFactory.new({from: sender});
            let channel = await factory.createChannel(receiver, Token.address, challengePeriod, {from: sender}); 
            let channelAddress = channel.logs[0].args._channelAddress;
            
            await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: sender});
            await factory.rechargeChannel(channelAddress, new BigNumber(500).times(new BigNumber(10).pow(18)), {from: sender});  
            assert.strictEqual((await Token.balanceOf(channelAddress)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 500);
            let balance = new BigNumber(100).times(new BigNumber(10).pow(18)); 
            let hash = web3.utils.soliditySha3(receiver, balance, channelAddress);
            let sig = await web3.eth.sign(hash, sender); 
            sig = sig.substr(2, sig.length);
            let rbal = '0x' + sig.substr(0, 64);
            let sbal = '0x' + sig.substr(64, 64);
            let vbal = web3.utils.toDecimal(sig.substr(128, 2)) + 27;

            let closingHash = web3.utils.soliditySha3(sender, balance, channelAddress);
            let closingSig = await web3.eth.sign(closingHash, receiver); 
            closingSig = closingSig.substr(2, closingSig.length);
            let rclose = '0x' + closingSig.substr(0, 64);
            let sclose = '0x' + closingSig.substr(64, 64);
            let vclose = web3.utils.toDecimal(closingSig.substr(128, 2)) + 27;
            let senderTokens = (await Token.balanceOf(sender)).dividedBy(new BigNumber(10).pow(18)).toNumber();
            await factory.channelMutualSettlement(channelAddress, balance, vbal, rbal, sbal, vclose, rclose, sclose ,{from: receiver});
            assert.strictEqual((await Token.balanceOf(receiver)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 100);
            // 400 = remainingTokens which will returned back to sender
            assert.strictEqual((await Token.balanceOf(sender)).dividedBy(new BigNumber(10).pow(18)).toNumber(), senderTokens+400); 
            let channelDetails = await factory.getInfo(channelAddress);
            assert.strictEqual(new BigNumber(channelDetails[5]).toNumber(), 4); //status : 4 = Settled
        });


        it("channelMutualSettlement : After withdrawing once (By Receiver)", async()=>{
            let Token = await TestToken.new({from: sender});
            let challengePeriod = 400;
            // Test contract will be used as testrpc add prefix while signing
            let factory = await TestFactory.new({from: sender});
            let channel = await factory.createChannel(receiver, Token.address, challengePeriod, {from: sender}); 
            let channelAddress = channel.logs[0].args._channelAddress;
            
            await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: sender});
            await factory.rechargeChannel(channelAddress, new BigNumber(500).times(new BigNumber(10).pow(18)), {from: sender});  
            assert.strictEqual((await Token.balanceOf(channelAddress)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 500);
            let balance = new BigNumber(100).times(new BigNumber(10).pow(18)); 
            let hash = web3.utils.soliditySha3(receiver, balance, channelAddress);
            let sig = await web3.eth.sign(hash, sender); 
            sig = sig.substr(2, sig.length);
            let r = '0x' + sig.substr(0, 64);
            let s = '0x' + sig.substr(64, 64);
            let v = web3.utils.toDecimal(sig.substr(128, 2)) + 27;
            await factory.withdrawFromChannel(channelAddress, balance, v, r, s, {from: receiver});      
            let channelDetails1 = await factory.getInfo(channelAddress);
            assert.strictEqual(new BigNumber(channelDetails1[5]).toNumber(), 2); //status : 2 = Withdrawn
            
            let balance2 = new BigNumber(400).times(new BigNumber(10).pow(18));
            let balanceHash = web3.utils.soliditySha3(receiver, balance2, channelAddress);
            let balanceSig = await web3.eth.sign(balanceHash, sender); 
            balanceSig = balanceSig.substr(2, balanceSig.length);
            let rbal = '0x' + balanceSig.substr(0, 64);
            let sbal = '0x' + balanceSig.substr(64, 64);
            let vbal = web3.utils.toDecimal(balanceSig.substr(128, 2)) + 27;
            let closingHash = web3.utils.soliditySha3(sender, balance2, channelAddress);
            let closingSig = await web3.eth.sign(closingHash, receiver); 
            closingSig = closingSig.substr(2, closingSig.length);
            let rclose = '0x' + closingSig.substr(0, 64);
            let sclose = '0x' + closingSig.substr(64, 64);
            let vclose = web3.utils.toDecimal(closingSig.substr(128, 2)) + 27;
            let senderTokens = (await Token.balanceOf(sender)).dividedBy(new BigNumber(10).pow(18)).toNumber();
            await factory.channelMutualSettlement(channelAddress, balance2, vbal, rbal, sbal, vclose, rclose, sclose ,{from: receiver});
            assert.strictEqual((await Token.balanceOf(receiver)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 400);
            // 100 = remainingTokens which will returned back to sender
            assert.strictEqual((await Token.balanceOf(sender)).dividedBy(new BigNumber(10).pow(18)).toNumber(), senderTokens+100); 
            let channelDetails = await factory.getInfo(channelAddress);
            assert.strictEqual(new BigNumber(channelDetails[5]).toNumber(), 4); //status : 4 = Settled
        });

        it("channelMutualSettlement : Tokens will be transferred respectively (By Receiver)", async()=>{
        let Token = await TestToken.new({from: sender});
        let challengePeriod = 400;
        // Test contract will be used as testrpc add prefix while signing
        let factory = await TestFactory.new({from: sender});
        let channel = await factory.createChannel(receiver, Token.address, challengePeriod, {from: sender}); 
        let channelAddress = channel.logs[0].args._channelAddress;
        
        await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: sender});
        await factory.rechargeChannel(channelAddress, new BigNumber(500).times(new BigNumber(10).pow(18)), {from: sender});  
        assert.strictEqual((await Token.balanceOf(channelAddress)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 500);
        let balance = new BigNumber(100).times(new BigNumber(10).pow(18)); 
        let hash = web3.utils.soliditySha3(receiver, balance, channelAddress);
        let sig = await web3.eth.sign(hash, sender); 
        sig = sig.substr(2, sig.length);
        let rbal = '0x' + sig.substr(0, 64);
        let sbal = '0x' + sig.substr(64, 64);
        let vbal = web3.utils.toDecimal(sig.substr(128, 2)) + 27;

        let closingHash = web3.utils.soliditySha3(sender, balance, channelAddress);
        let closingSig = await web3.eth.sign(closingHash, receiver); 
        closingSig = closingSig.substr(2, closingSig.length);
        let rclose = '0x' + closingSig.substr(0, 64);
        let sclose = '0x' + closingSig.substr(64, 64);
        let vclose = web3.utils.toDecimal(closingSig.substr(128, 2)) + 27;
        let senderTokens = (await Token.balanceOf(sender)).dividedBy(new BigNumber(10).pow(18)).toNumber();
        await factory.channelMutualSettlement(channelAddress, balance, vbal, rbal, sbal, vclose, rclose, sclose ,{from: sender});
        assert.strictEqual((await Token.balanceOf(receiver)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 100);
        // 400 = remainingTokens which will returned back to sender
        assert.strictEqual((await Token.balanceOf(sender)).dividedBy(new BigNumber(10).pow(18)).toNumber(), senderTokens+400); 
        let channelDetails = await factory.getInfo(channelAddress);
        assert.strictEqual(new BigNumber(channelDetails[5]).toNumber(), 4); //status : 4 = Settled
    });



        it("channelMutualSettlement : using non-contract channel Address (should fail)", async()=>{
            let Token = await TestToken.new({from: sender});
            let challengePeriod = 400;
            // Test contract will be used as testrpc add prefix while signing
            let factory = await TestFactory.new({from: sender});
            let channel = await factory.createChannel(receiver, Token.address, challengePeriod, {from: sender}); 
            let channelAddress = channel.logs[0].args._channelAddress;
            
            await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: sender});
            await factory.rechargeChannel(channelAddress, new BigNumber(500).times(new BigNumber(10).pow(18)), {from: sender});  
            assert.strictEqual((await Token.balanceOf(channelAddress)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 500);
            let balance = new BigNumber(100).times(new BigNumber(10).pow(18)); 
            let hash = web3.utils.soliditySha3(receiver, balance, channelAddress);
            let sig = await web3.eth.sign(hash, sender); 
            sig = sig.substr(2, sig.length);
            let rbal = '0x' + sig.substr(0, 64);
            let sbal = '0x' + sig.substr(64, 64);
            let vbal = web3.utils.toDecimal(sig.substr(128, 2)) + 27;

            let closingHash = web3.utils.soliditySha3(sender, balance, channelAddress);
            let closingSig = await web3.eth.sign(closingHash, receiver); 
            closingSig = closingSig.substr(2, closingSig.length);
            let rclose = '0x' + closingSig.substr(0, 64);
            let sclose = '0x' + closingSig.substr(64, 64);
            let vclose = web3.utils.toDecimal(closingSig.substr(128, 2)) + 27;
            try{
                // channel address = testAddress1
                await factory.channelMutualSettlement(testAddress1, balance, vbal, rbal, sbal, vclose, rclose, sclose , {from: receiver});
            }catch(error){
                //console.log(error);
                Utils.ensureException(error);
            } 
        });
    

        it("channelMutualSettlement : with zero balance (should fail)", async()=>{
            let Token = await TestToken.new({from: sender});
            let challengePeriod = 400;
            // Test contract will be used as testrpc add prefix while signing
            let factory = await TestFactory.new({from: sender});
            let channel = await factory.createChannel(receiver, Token.address, challengePeriod, {from: sender}); 
            let channelAddress = channel.logs[0].args._channelAddress;
            
            await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: sender});
            await factory.rechargeChannel(channelAddress, new BigNumber(500).times(new BigNumber(10).pow(18)), {from: sender});  
            assert.strictEqual((await Token.balanceOf(channelAddress)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 500);
            let balance = new BigNumber(0).times(new BigNumber(10).pow(18)); 
            let hash = web3.utils.soliditySha3(receiver, balance, channelAddress);
            let sig = await web3.eth.sign(hash, sender); 
            sig = sig.substr(2, sig.length);
            let rbal = '0x' + sig.substr(0, 64);
            let sbal = '0x' + sig.substr(64, 64);
            let vbal = web3.utils.toDecimal(sig.substr(128, 2)) + 27;

            let closingHash = web3.utils.soliditySha3(sender, balance, channelAddress);
            let closingSig = await web3.eth.sign(closingHash, receiver); 
            closingSig = closingSig.substr(2, closingSig.length);
            let rclose = '0x' + closingSig.substr(0, 64);
            let sclose = '0x' + closingSig.substr(64, 64);
            let vclose = web3.utils.toDecimal(closingSig.substr(128, 2)) + 27;
            try{
                await factory.channelMutualSettlement(channelAddress, balance, vbal, rbal, sbal, vclose, rclose, sclose , {from: receiver});
            }catch(error){
                //console.log(error);
                Utils.ensureException(error);
            }
        });

        it("channelMutualSettlement : with non-sender-receiver address (should fail)", async()=>{
            let Token = await TestToken.new({from: sender});
            let challengePeriod = 400;
            // Test contract will be used as testrpc add prefix while signing
            let factory = await TestFactory.new({from: sender});
            let channel = await factory.createChannel(receiver, Token.address, challengePeriod, {from: sender}); 
            let channelAddress = channel.logs[0].args._channelAddress;
            
            await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: sender});
            await factory.rechargeChannel(channelAddress, new BigNumber(500).times(new BigNumber(10).pow(18)), {from: sender});  
            assert.strictEqual((await Token.balanceOf(channelAddress)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 500);
            let balance = new BigNumber(0).times(new BigNumber(10).pow(18)); 
            let hash = web3.utils.soliditySha3(receiver, balance, channelAddress);
            let sig = await web3.eth.sign(hash, sender); 
            sig = sig.substr(2, sig.length);
            let rbal = '0x' + sig.substr(0, 64);
            let sbal = '0x' + sig.substr(64, 64);
            let vbal = web3.utils.toDecimal(sig.substr(128, 2)) + 27;

            let closingHash = web3.utils.soliditySha3(sender, balance, channelAddress);
            let closingSig = await web3.eth.sign(closingHash, receiver); 
            closingSig = closingSig.substr(2, closingSig.length);
            let rclose = '0x' + closingSig.substr(0, 64);
            let sclose = '0x' + closingSig.substr(64, 64);
            let vclose = web3.utils.toDecimal(closingSig.substr(128, 2)) + 27;
            try{
                await factory.channelMutualSettlement(channelAddress, balance, vbal, rbal, sbal, vclose, rclose, sclose , {from: testAddress1});
            }catch(error){
                //console.log(error);
                Utils.ensureException(error);
            }
            
        });

        it("channelMutualSettlement : without recharging (should fail)", async()=>{
            let Token = await TestToken.new({from: sender});
            let challengePeriod = 400;
            // Test contract will be used as testrpc add prefix while signing
            let factory = await TestFactory.new({from: sender});
            let channel = await factory.createChannel(receiver, Token.address, challengePeriod, {from: sender}); 
            let channelAddress = channel.logs[0].args._channelAddress;
            
            let balance = new BigNumber(100).times(new BigNumber(10).pow(18)); 
            let hash = web3.utils.soliditySha3(receiver, balance, channelAddress);
            let sig = await web3.eth.sign(hash, sender); 
            sig = sig.substr(2, sig.length);
            let rbal = '0x' + sig.substr(0, 64);
            let sbal = '0x' + sig.substr(64, 64);
            let vbal = web3.utils.toDecimal(sig.substr(128, 2)) + 27;

            let closingHash = web3.utils.soliditySha3(sender, balance, channelAddress);
            let closingSig = await web3.eth.sign(closingHash, receiver); 
            closingSig = closingSig.substr(2, closingSig.length);
            let rclose = '0x' + closingSig.substr(0, 64);
            let sclose = '0x' + closingSig.substr(64, 64);
            let vclose = web3.utils.toDecimal(closingSig.substr(128, 2)) + 27;
            try{
                await factory.channelMutualSettlement(channelAddress, balance, vbal, rbal, sbal, vclose, rclose, sclose , {from: receiver});
            }catch(error){
                //console.log(error);
                Utils.ensureException(error);
            }        
        });

        it("channelMutualSettlement : withdrawing more than deposit (should fail)", async()=>{
            let Token = await TestToken.new({from: sender});
            let challengePeriod = 400;
            // Test contract will be used as testrpc add prefix while signing
            let factory = await TestFactory.new({from: sender});
            let channel = await factory.createChannel(receiver, Token.address, challengePeriod, {from: sender}); 
            let channelAddress = channel.logs[0].args._channelAddress;
            
            await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: sender});
            await factory.rechargeChannel(channelAddress, new BigNumber(500).times(new BigNumber(10).pow(18)), {from: sender});  
            assert.strictEqual((await Token.balanceOf(channelAddress)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 500);
            let balance = new BigNumber(501).times(new BigNumber(10).pow(18)); //501>500
            let hash = web3.utils.soliditySha3(receiver, balance, channelAddress);
            let sig = await web3.eth.sign(hash, sender); 
            sig = sig.substr(2, sig.length);
            let rbal = '0x' + sig.substr(0, 64);
            let sbal = '0x' + sig.substr(64, 64);
            let vbal = web3.utils.toDecimal(sig.substr(128, 2)) + 27;

            let closingHash = web3.utils.soliditySha3(sender, balance, channelAddress);
            let closingSig = await web3.eth.sign(closingHash, receiver); 
            closingSig = closingSig.substr(2, closingSig.length);
            let rclose = '0x' + closingSig.substr(0, 64);
            let sclose = '0x' + closingSig.substr(64, 64);
            let vclose = web3.utils.toDecimal(closingSig.substr(128, 2)) + 27;
            try{
                await factory.channelMutualSettlement(channelAddress, balance, vbal, rbal, sbal, vclose, rclose, sclose, {from: receiver});
            }catch(error){
                //console.log(error);
                Utils.ensureException(error);
            }
        });

    it("channelMutualSettlement : with balance hash signed by non-sender address (should fail)", async()=>{
            let Token = await TestToken.new({from: sender});
            let challengePeriod = 400;
            // Test contract will be used as testrpc add prefix while signing
            let factory = await TestFactory.new({from: sender});
            let channel = await factory.createChannel(receiver, Token.address, challengePeriod, {from: sender}); 
            let channelAddress = channel.logs[0].args._channelAddress;
            
            await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: sender});
            await factory.rechargeChannel(channelAddress, new BigNumber(500).times(new BigNumber(10).pow(18)), {from: sender});  
            assert.strictEqual((await Token.balanceOf(channelAddress)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 500);
            let balance = new BigNumber(100).times(new BigNumber(10).pow(18)); 
            let hash = web3.utils.soliditySha3(receiver, balance, channelAddress);
            let sig = await web3.eth.sign(hash, accounts[2]); //signed by accounts[2] 
            sig = sig.substr(2, sig.length);
            let rbal = '0x' + sig.substr(0, 64);
            let sbal = '0x' + sig.substr(64, 64);
            let vbal = web3.utils.toDecimal(sig.substr(128, 2)) + 27;

            let closingHash = web3.utils.soliditySha3(sender, balance, channelAddress);
            let closingSig = await web3.eth.sign(closingHash, receiver); 
            closingSig = closingSig.substr(2, closingSig.length);
            let rclose = '0x' + closingSig.substr(0, 64);
            let sclose = '0x' + closingSig.substr(64, 64);
            let vclose = web3.utils.toDecimal(closingSig.substr(128, 2)) + 27;
        try{
            await factory.channelMutualSettlement(channelAddress, balance, vbal, rbal, sbal, vclose, rclose, sclose, {from: receiver});
        }catch(error){
            //console.log(error);
            Utils.ensureException(error);
        }        
    });

        it("channelMutualSettlement : with closing hash signed by non-receiver address (should fail)", async()=>{
            let Token = await TestToken.new({from: sender});
            let challengePeriod = 400;
            // Test contract will be used as testrpc add prefix while signing
            let factory = await TestFactory.new({from: sender});
            let channel = await factory.createChannel(receiver, Token.address, challengePeriod, {from: sender}); 
            let channelAddress = channel.logs[0].args._channelAddress;
            
            await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: sender});
            await factory.rechargeChannel(channelAddress, new BigNumber(500).times(new BigNumber(10).pow(18)), {from: sender});  
            assert.strictEqual((await Token.balanceOf(channelAddress)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 500);
            let balance = new BigNumber(100).times(new BigNumber(10).pow(18)); 
            let hash = web3.utils.soliditySha3(receiver, balance, channelAddress);
            let sig = await web3.eth.sign(hash, sender); 
            sig = sig.substr(2, sig.length);
            let rbal = '0x' + sig.substr(0, 64);
            let sbal = '0x' + sig.substr(64, 64);
            let vbal = web3.utils.toDecimal(sig.substr(128, 2)) + 27;

            let closingHash = web3.utils.soliditySha3(sender, balance, channelAddress);
            let closingSig = await web3.eth.sign(closingHash, accounts[2]); //signed by accounts[2] 
            closingSig = closingSig.substr(2, closingSig.length);
            let rclose = '0x' + closingSig.substr(0, 64);
            let sclose = '0x' + closingSig.substr(64, 64);
            let vclose = web3.utils.toDecimal(closingSig.substr(128, 2)) + 27;
            try{
                await factory.channelMutualSettlement(channelAddress, balance, vbal, rbal, sbal, vclose, rclose, sclose, {from: receiver});
            }catch(error){
                //console.log(error);
                Utils.ensureException(error);
            }        
        });
});

    describe("channelChallengedSettlement", async() => {
    
        it("channelChallengedSettlement : Challenge Period will be started", async()=>{
            let Token = await TestToken.new({from: sender});
            let challengePeriod = 400;
            let factory = await Factory.new({from: sender});
            let channel = await factory.createChannel(receiver, Token.address, challengePeriod, {from: sender}); 
            let channelAddress = channel.logs[0].args._channelAddress;
            
            await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: sender});
            await factory.rechargeChannel(channelAddress, new BigNumber(500).times(new BigNumber(10).pow(18)), {from: sender});  
            assert.strictEqual((await Token.balanceOf(channelAddress)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 500);
            let balance = new BigNumber(100).times(new BigNumber(10).pow(18));        
            await factory.channelChallengedSettlement(channelAddress, balance,{from: sender});
            let challengeDetails = await factory.getChallengeDetails(channelAddress);
            assert.strictEqual(challengeDetails[2].dividedBy(new BigNumber(10).pow(18)).toNumber(), 100);
            assert.strictEqual(challengeDetails[1].toNumber(), challengePeriod); 
            let channelDetails = await factory.getInfo(channelAddress);                    
            assert.strictEqual(new BigNumber(channelDetails[5]).toNumber(), 3); //status : 3 = InChallenge
        });

        it("channelChallengedSettlement : mutual settlement by receiver after initiation of challenge period", async()=>{
            let Token = await TestToken.new({from:sender});
            let challengePeriod = 400;
            let factory = await TestFactory.new({from:sender});
            let channel = await factory.createChannel(receiver, Token.address, challengePeriod, {from:sender}); //sender = accounts[0]
            let channelAddress = channel.logs[0].args._channelAddress;
            
            await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)), {from:sender});
            await factory.rechargeChannel(channelAddress, new BigNumber(500).times(new BigNumber(10).pow(18)), {from:sender});  
            assert.strictEqual((await Token.balanceOf(channelAddress)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 500);
            let balance = new BigNumber(100).times(new BigNumber(10).pow(18));
            await factory.channelChallengedSettlement(channelAddress, balance,{from: sender});
            let channelDetails1 = await factory.getInfo(channelAddress);
            assert.strictEqual(new BigNumber(channelDetails1[5]).toNumber(), 3); //status : 3 = InChallenge 
            let balanceHash = web3.utils.soliditySha3(receiver, balance, channelAddress);
            let balanceSig = await web3.eth.sign(balanceHash, sender); 
            balanceSig = balanceSig.substr(2, balanceSig.length);
            let rbal = '0x' + balanceSig.substr(0, 64);
            let sbal = '0x' + balanceSig.substr(64, 64);
            let vbal = web3.utils.toDecimal(balanceSig.substr(128, 2)) + 27;

            let closingHash = web3.utils.soliditySha3(sender, balance, channelAddress);
            let closingSig = await web3.eth.sign(closingHash, receiver); 
            closingSig = closingSig.substr(2, closingSig.length);
            let rclose = '0x' + closingSig.substr(0, 64);
            let sclose = '0x' + closingSig.substr(64, 64);
            let vclose = web3.utils.toDecimal(closingSig.substr(128, 2)) + 27;
            let senderTokens = (await Token.balanceOf(accounts[0])).dividedBy(new BigNumber(10).pow(18)).toNumber()
            await factory.channelMutualSettlement(channelAddress, balance, vbal, rbal, sbal, vclose, rclose, sclose ,{from: receiver});
            assert.strictEqual((await Token.balanceOf(receiver)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 100);
            // 400 = remainingTokens which will returned back to sender
            assert.strictEqual((await Token.balanceOf(accounts[0])).dividedBy(new BigNumber(10).pow(18)).toNumber(), senderTokens+400); 
            let channelDetails = await factory.getInfo(channelAddress);
            assert.strictEqual(new BigNumber(channelDetails[5]).toNumber(), 4); //status : 4 = Settled
        });

        it("channelChallengedSettlement : with non-contract channel address (should fail)", async()=>{
            let Token = await TestToken.new({from: sender});
            let challengePeriod = 400;
            let factory = await Factory.new({from: sender});
            let channel = await factory.createChannel(receiver, Token.address, challengePeriod, {from: sender}); 
            let channelAddress = channel.logs[0].args._channelAddress;
            
            await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: sender});
            await factory.rechargeChannel(channelAddress, new BigNumber(500).times(new BigNumber(10).pow(18)), {from: sender});  
            assert.strictEqual((await Token.balanceOf(channelAddress)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 500);
            let balance = new BigNumber(100).times(new BigNumber(10).pow(18)); 
            try{
                await factory.channelChallengedSettlement(testAddress1, balance,{from: sender});
            }catch(error){
                //console.log(error);
                Utils.ensureException(error);
            }       
        });

        it("channelChallengedSettlement : with non-sender address (should fail)", async()=>{
            let Token = await TestToken.new({from: sender});
            let challengePeriod = 400;
            let factory = await Factory.new({from: sender});
            let channel = await factory.createChannel(receiver, Token.address, challengePeriod, {from: sender}); 
            let channelAddress = channel.logs[0].args._channelAddress;
            
            await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: sender});
            await factory.rechargeChannel(channelAddress, new BigNumber(500).times(new BigNumber(10).pow(18)), {from: sender});  
            assert.strictEqual((await Token.balanceOf(channelAddress)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 500);
            let balance = new BigNumber(100).times(new BigNumber(10).pow(18));
            try{
                await factory.channelChallengedSettlement(channelAddress, balance,{from: testAddress1});
            }catch(error){
                //console.log(error);
                Utils.ensureException(error);
            }       
        });

        it("channelChallengedSettlement : without recharging channel (should fail)", async()=>{
            let Token = await TestToken.new({from: sender});
            let challengePeriod = 400;
            let factory = await Factory.new({from: sender});
            let channel = await factory.createChannel(receiver, Token.address, challengePeriod, {from: sender}); 
            let channelAddress = channel.logs[0].args._channelAddress;
            
            let balance = new BigNumber(100).times(new BigNumber(10).pow(18));
            try{
                await factory.channelChallengedSettlement(channelAddress, balance,{from: sender});
            }catch(error){
                //console.log(error);
                Utils.ensureException(error);
            }       
        });

        it("channelChallengedSettlement : with balance more than deposit (should fail)", async()=>{
            let Token = await TestToken.new({from: sender});
            let challengePeriod = 400;
            let factory = await Factory.new({from: sender});
            let channel = await factory.createChannel(receiver, Token.address, challengePeriod, {from: sender}); 
            let channelAddress = channel.logs[0].args._channelAddress;
            
            await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: sender});
            await factory.rechargeChannel(channelAddress, new BigNumber(500).times(new BigNumber(10).pow(18)), {from: sender});  
            assert.strictEqual((await Token.balanceOf(channelAddress)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 500);
            let balance = new BigNumber(501).times(new BigNumber(10).pow(18)); //501>500
            try{
                await factory.channelChallengedSettlement(channelAddress, balance,{from: accounts[0]});
            }catch(error){
                //console.log(error);
                Utils.ensureException(error);
            }       
        });

        it("channelChallengedSettlement : receiver trying to withdraw during challenge period (should fail)", async()=>{
            let Token = await TestToken.new({from: sender});
            let challengePeriod = 400;
            let factory = await TestFactory.new({from: sender});
            let channel = await factory.createChannel(receiver, Token.address, challengePeriod, {from: sender}); 
            let channelAddress = channel.logs[0].args._channelAddress;
            
            await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: sender});
            await factory.rechargeChannel(channelAddress, new BigNumber(500).times(new BigNumber(10).pow(18)), {from: sender});  
            assert.strictEqual((await Token.balanceOf(channelAddress)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 500);
            let balance = new BigNumber(100).times(new BigNumber(10).pow(18));
            await factory.channelChallengedSettlement(channelAddress, balance,{from: sender});

            let hash = web3.utils.soliditySha3(receiver, balance, channelAddress);
            let sig = await web3.eth.sign(hash, sender);
            sig = sig.substr(2, sig.length);
            let r = '0x' + sig.substr(0, 64);
            let s = '0x' + sig.substr(64, 64);
            let v = web3.utils.toDecimal(sig.substr(128, 2)) + 27;
            try{
                await factory.withdrawFromChannel(channelAddress, balance, r, s, v, {from: receiver});
            }catch(error){
                //console.log(error);
                Utils.ensureException(error);
            }       
        });

});
        describe("channelAfterChallengeSettlement", async() => {

        it("channelAfterChallengeSettlement : channel will be settled by sender after challengePeriod", async()=>{
            let Token = await TestToken.new();
            let challengePeriod = 400;
            let factory = await Factory.new();
            let channel = await factory.createChannel(receiver, Token.address, challengePeriod, {from: testAddress1}); 
            let channelAddress = channel.logs[0].args._channelAddress;

            await Token.transfer(testAddress1, new BigNumber(700).times(new BigNumber(10).pow(18))); 
            assert.strictEqual(new BigNumber(await Token.balanceOf(testAddress1)).toNumber(), new BigNumber(700).times(new BigNumber(10).pow(18)).toNumber()); 
            await Token.approve(channelAddress, new BigNumber(600).times(new BigNumber(10).pow(18)),{from: testAddress1});
            await factory.rechargeChannel(channelAddress, new BigNumber(500).times(new BigNumber(10).pow(18)),{from: testAddress1});  
            assert.strictEqual((await Token.balanceOf(channelAddress)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 500);
            let balance = new BigNumber(200).times(new BigNumber(10).pow(18));
            await factory.channelChallengedSettlement(channelAddress, balance,{from: testAddress1});
            assert.strictEqual((await Token.balanceOf(testAddress1)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 200); // 700-500 = 200 
            time.increaseTime(410); // ensure challengePeriod is passed 
            await factory.channelAfterChallengeSettlement(channelAddress, {from: testAddress1});
            assert.strictEqual((await Token.balanceOf(receiver)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 200); // 200 = balance 
            assert.strictEqual((await Token.balanceOf(testAddress1)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 500); // 200+ (500-200) = 500 
            let channelDetails = await factory.getInfo(channelAddress);
            assert.strictEqual(new BigNumber(channelDetails[5]).toNumber(), 4); //status: 4 = settled    
        });

        it("channelAfterChallengeSettlement : with non-contract channel address (should fail)", async()=>{
            let Token = await TestToken.new({from: sender});
            let challengePeriod = 400;
            let factory = await TestFactory.new({from: sender});
            let channel = await factory.createChannel(receiver, Token.address, challengePeriod, {from: sender}); 
            let channelAddress = channel.logs[0].args._channelAddress;
            
            await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: sender});
            await factory.rechargeChannel(channelAddress, new BigNumber(500).times(new BigNumber(10).pow(18)), {from: sender});  
            assert.strictEqual((await Token.balanceOf(channelAddress)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 500);
            let balance = new BigNumber(100).times(new BigNumber(10).pow(18));
            await factory.channelChallengedSettlement(channelAddress, balance,{from: sender});
            time.increaseTime(410); // To ensure challengePeriod is passed 
            try{
                await factory.channelAfterChallengeSettlement(testAddress1, {from: sender});     
            }catch(error){
                //console.log(error);
                Utils.ensureException(error);
            }        
        });

        it("channelAfterChallengeSettlement : with non-sender address (should fail)", async()=>{
            let Token = await TestToken.new({from: sender});
            let challengePeriod = 400;
            let factory = await TestFactory.new({from: sender});
            let channel = await factory.createChannel(receiver, Token.address, challengePeriod, {from: sender}); 
            let channelAddress = channel.logs[0].args._channelAddress;
            
            await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: sender});
            await factory.rechargeChannel(channelAddress, new BigNumber(500).times(new BigNumber(10).pow(18)), {from: sender});  
            assert.strictEqual((await Token.balanceOf(channelAddress)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 500);
            let balance = new BigNumber(100).times(new BigNumber(10).pow(18));
            await factory.channelChallengedSettlement(channelAddress, balance,{from: sender});
            time.increaseTime(410); 
            try{
                await factory.channelAfterChallengeSettlement(channelAddress, {from: testAddress1});     
            }catch(error){
                //console.log(error);
                Utils.ensureException(error);
            }        
        });

        it("channelAfterChallengeSettlement : without triggering challenge period (should fail)", async()=>{
            let Token = await TestToken.new({from: sender});
            let challengePeriod = 400;
            let factory = await TestFactory.new({from: sender});
            let channel = await factory.createChannel(receiver, Token.address, challengePeriod, {from: sender}); 
            let channelAddress = channel.logs[0].args._channelAddress;
            
            await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: sender});
            await factory.rechargeChannel(channelAddress, new BigNumber(500).times(new BigNumber(10).pow(18)), {from: sender});  
            assert.strictEqual((await Token.balanceOf(channelAddress)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 500);
            let balance = new BigNumber(100).times(new BigNumber(10).pow(18)); 
            try{
                await factory.channelAfterChallengeSettlement(channelAddress, {from: sender});     
            }catch(error){
                //console.log(error);
                Utils.ensureException(error);
            }        
        });

        it("channelAfterChallengeSettlement : during challenge period (should fail)", async()=>{
            let Token = await TestToken.new({from: sender});
            let challengePeriod = 400;
            let factory = await TestFactory.new({from: sender});
            let channel = await factory.createChannel(receiver, Token.address, challengePeriod, {from: sender}); 
            let channelAddress = channel.logs[0].args._channelAddress;
            
            await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)), {from: sender});
            await factory.rechargeChannel(channelAddress, new BigNumber(500).times(new BigNumber(10).pow(18)), {from: sender});  
            assert.strictEqual((await Token.balanceOf(channelAddress)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 500);
            let balance = new BigNumber(100).times(new BigNumber(10).pow(18));
            await factory.channelChallengedSettlement(channelAddress, balance,{from: sender});
            try{
                await factory.channelAfterChallengeSettlement(channelAddress, {from: sender});     
            }catch(error){
                //console.log(error);
                Utils.ensureException(error);
            }        
        });
});
    describe("getters", async()=>{
        it("getAllChannelsAsSender : all channel addresses as sender will be returned", async()=>{
            let Token = await TestToken.new();
            let challengePeriod = 400;
            let factory = await Factory.new();
            let channel1 = await factory.createChannel(receiver, Token.address, challengePeriod); //sender = accounts[0]
            let channelAddress1 = channel1.logs[0].args._channelAddress;

            let channel2 = await factory.createChannel(testAddress2, Token.address, challengePeriod); //sender = accounts[0]
            let channelAddress2 = channel2.logs[0].args._channelAddress;

            let allchannels = await factory.getAllChannelsAsSender();
            
            assert.strictEqual(allchannels[0], channelAddress1); 
            assert.strictEqual(allchannels[1], channelAddress2); 
            assert.strictEqual(allchannels.length, 2);                
        });

        it("getAllChannelsAsReceiver : all channel addresses as receiver will be returned", async()=>{
            let Token = await TestToken.new();
            let challengePeriod = 400;
            let factory = await Factory.new();
            let channel1 = await factory.createChannel(receiver, Token.address, challengePeriod); //sender = accounts[0]
            let channelAddress1 = channel1.logs[0].args._channelAddress;

            let channel2 = await factory.createChannel(receiver, Token.address, challengePeriod); //sender = accounts[0]
            let channelAddress2 = channel2.logs[0].args._channelAddress;

            let allchannels = await factory.getAllChannelsAsReceiver({from: receiver});
            
            assert.strictEqual(allchannels[0], channelAddress1); 
            assert.strictEqual(allchannels[1], channelAddress2); 
            assert.strictEqual(allchannels.length, 2);                
        });

        it("getAllChannelsAsReceiver : all channel addresses as receiver will be returned", async()=>{
            let Token = await TestToken.new({from: sender});
            let challengePeriod = 400;
            let factory = await Factory.new({from: sender});
            let channel1 = await factory.createChannel(receiver, Token.address, challengePeriod, {from: sender}); //sender = accounts[0]
            let channelAddress1 = channel1.logs[0].args._channelAddress;
            let channelUsers = await factory.getChannelUsers(channelAddress1);
            assert.strictEqual(channelUsers[0], sender); 
            assert.strictEqual(channelUsers[1], receiver);
                           
        });
    });

 });