const ECV = artifacts.require('ECVerification.sol');
const Factory = artifacts.require('Factory.sol');
const TestToken = artifacts.require('TestToken.sol');
const BigNumber = require('bignumber.js');
const Web3 = require('web3');
const Utils = require('./helpers/utils');
const ethUtil = require('ethereumjs-util');
const time = require('./helpers/time');
const transactionMined = require('./helpers/transactionMined');
import ether from './helpers/ether';
import latestTime from './helpers/latestTime';
import leftPad from 'left-pad';

var web3 = new Web3('http://localhost:9545');

contract('Factory', (accounts) => {
    
    let receiver;
    let sender;
    let testAddress1;
    let testAddress2;    

    beforeEach(async() => {
        
        // // to manage the gas for test cases tranasaction execution
        // web3.eth.sendTransaction({from:accounts[8], to:accounts[0], value: ether(1)});
        // web3.eth.sendTransaction({from:accounts[7], to:accounts[1], value: ether(1)});
        // web3.eth.sendTransaction({from:accounts[6], to:accounts[2], value: ether(1)});

        receiver = accounts[1];
        testAddress1 = accounts[2];
        testAddress2 = accounts[3];
        
    });

    it("Verify constructors", async()=>{
        let factory = await Factory.new();

        assert.strictEqual(await factory.owner(), accounts[0]); // accounts[0] = default
    });


    it("createChannel : New channel will be created", async()=>{
        let Token = await TestToken.new();
        let challengePeriod = 500;
        let factory = await Factory.new();
        let channel = await factory.createChannel(receiver, Token.address, challengePeriod);
        let channelAddress = channel.logs[0].args._channelAddress;
        let channelDetails = await factory.getInfo(channelAddress);        
        
        assert.strictEqual(channelDetails[0], accounts[0]); // accounts[0] = default
        assert.strictEqual(channelDetails[1], receiver);
        assert.strictEqual(channelDetails[2], Token.address);
        assert.strictEqual(new BigNumber(channelDetails[3]).toNumber(), challengePeriod); 
        assert.strictEqual(new BigNumber(channelDetails[5]).toNumber(), 0); //status : 0 = Initiated
    });


    it("createChannel : with invalid receiver address (should fail)", async()=>{
        let Token = await TestToken.new();
        let challengePeriod = 500;
        let factory = await Factory.new();
        try{
            await factory.createChannel(0, Token.address, challengePeriod);
        }catch(error){
            //console.log(error);
            Utils.ensureException(error);
        }        
    });

    it("createChannel : with non-contract token address (should fail)", async()=>{
        let challengePeriod = 500;
        let factory = await Factory.new();
        try{
            await factory.createChannel(receiver, testAddress1, challengePeriod);
        }catch(error){
            //console.log(error);
            Utils.ensureException(error);
        }        
    });

    it("createChannel : with no challenge Period (should fail)", async()=>{
        let Token = await TestToken.new();
        let challengePeriod = 0;
        let factory = await Factory.new();
        try{
            await factory.createChannel(receiver, Token.address, challengePeriod);
        }catch(error){
            //console.log(error);
            Utils.ensureException(error);
        }        
    });

    it("rechargeChannel : Approved tokens will be transferred to channel", async()=>{
        let Token = await TestToken.new();
        let challengePeriod = 500;
        let factory = await Factory.new();
        let channel = await factory.createChannel(receiver, Token.address, challengePeriod);
        let channelAddress = channel.logs[0].args._channelAddress;
        await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)));
        assert.strictEqual(new BigNumber(await Token.allowance(accounts[0], channelAddress)).toNumber(), 
                            new BigNumber(1000).times(new BigNumber(10).pow(18)).toNumber());
        let tokenAmount = 500;
        await factory.rechargeChannel(channelAddress, new BigNumber(tokenAmount).times(new BigNumber(10).pow(18))); 
        assert.strictEqual((await Token.balanceOf(channelAddress)).dividedBy(new BigNumber(10).pow(18)).toNumber(), tokenAmount);
        
        let channelDetails = await factory.getInfo(channelAddress);        

        assert.strictEqual(new BigNumber(channelDetails[5]).toNumber(), 1); //status : 1 = Recharged
    });

    it("rechargeChannel : with non-contract channel address (should fail)", async()=>{
        let Token = await TestToken.new();
        let challengePeriod = 500;
        let factory = await Factory.new();
        let channel = await factory.createChannel(receiver, Token.address, challengePeriod);
        let channelAddress = channel.logs[0].args._channelAddress;
        await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)));
        try{
            await factory.rechargeChannel(testAddress1, new BigNumber(500).times(new BigNumber(10).pow(18)));      
        }catch(error){
            //console.log(error);
            Utils.ensureException(error);
        }
    });

    it("rechargeChannel : with zero deposit (should fail)", async()=>{
        let Token = await TestToken.new();
        let challengePeriod = 500;
        let factory = await Factory.new();
        let channel = await factory.createChannel(receiver, Token.address, challengePeriod);
        let channelAddress = channel.logs[0].args._channelAddress;
        await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)));
        try{
            await factory.rechargeChannel(channelAddress, 0); 
        }catch(error){
            //console.log(error);
            Utils.ensureException(error);
        }        
    });

    it("rechargeChannel : with origin as non-sender address (should fail)", async()=>{
        let Token = await TestToken.new();
        let challengePeriod = 500;
        let factory = await Factory.new();
        let channel = await factory.createChannel(receiver, Token.address, challengePeriod);
        let channelAddress = channel.logs[0].args._channelAddress;
        await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)));
        try{
            await factory.rechargeChannel(channelAddress, 500, {from: testAddress1}); 
        }catch(error){
            //console.log(error);
            Utils.ensureException(error);
        }        
    });

    it("rechargeChannel : without approving tokens (should fail)", async()=>{
        let Token = await TestToken.new();
        let challengePeriod = 500;
        let factory = await Factory.new();
        let channel = await factory.createChannel(receiver, Token.address, challengePeriod);
        let channelAddress = channel.logs[0].args._channelAddress;
        try{
            await factory.rechargeChannel(channelAddress, new BigNumber(500).times(new BigNumber(10).pow(18))); 
        }catch(error){
            //console.log(error);
            Utils.ensureException(error);
        }        
    });

    it("withdrawFromChannel : tokens will be transferred to receiver account", async()=>{
        let Token = await TestToken.new();
        let challengePeriod = 400;
        let factory = await Factory.new();
        let channel = await factory.createChannel(receiver, Token.address, challengePeriod); //sender = accounts[0]
        let channelAddress = channel.logs[0].args._channelAddress;
        
        await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)));
        await factory.rechargeChannel(channelAddress, new BigNumber(500).times(new BigNumber(10).pow(18)));  
        assert.strictEqual((await Token.balanceOf(channelAddress)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 500);
        let balance = new BigNumber(100).times(new BigNumber(10).pow(18))
        let hash = web3.utils.soliditySha3(receiver, balance, channelAddress);
        let sig = await web3.eth.sign(hash, accounts[0]);
        sig = sig.substr(2, sig.length);
        let r = '0x' + sig.substr(0, 64);
        let s = '0x' + sig.substr(64, 64);
        let v = web3.utils.toDecimal(sig.substr(128, 2)) + 27;
        await factory.withdrawFromChannel(channelAddress, balance, v,r,s, {from: receiver});     
        assert.strictEqual((await Token.balanceOf(receiver)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 100);
        
    });

    it("withdrawFromChannel : withdrawing 100 tokens twice", async()=>{
        let Token = await TestToken.new();
        let challengePeriod = 400;
        let factory = await Factory.new();
        let channel = await factory.createChannel(receiver, Token.address, challengePeriod); //sender = accounts[0]
        let channelAddress = channel.logs[0].args._channelAddress;
        
        await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)));
        await factory.rechargeChannel(channelAddress, new BigNumber(500).times(new BigNumber(10).pow(18)));  
        assert.strictEqual((await Token.balanceOf(channelAddress)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 500);
        let balance = new BigNumber(100).times(new BigNumber(10).pow(18))
        let hash = web3.utils.soliditySha3(receiver, balance, channelAddress);
        let sig = await web3.eth.sign(hash, accounts[0]);
        sig = sig.substr(2, sig.length);
        let r = '0x' + sig.substr(0, 64);
        let s = '0x' + sig.substr(64, 64);
        let v = web3.utils.toDecimal(sig.substr(128, 2)) + 27;
        await factory.withdrawFromChannel(channelAddress, balance, v,r,s, {from: receiver});     
        assert.strictEqual((await Token.balanceOf(receiver)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 100);
        
        await factory.withdrawFromChannel(channelAddress, balance, v, r, s, {from: receiver});     
        assert.strictEqual((await Token.balanceOf(receiver)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 200);
        assert.strictEqual((await Token.balanceOf(channelAddress)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 300);
        
     });

    it("withdrawFromChannel : with non-contract channel address (should fail)", async()=>{
        let Token = await TestToken.new();
        let challengePeriod = 1000;
        let factory = await Factory.new();
        let channel = await factory.createChannel(receiver, Token.address, challengePeriod);
        let channelAddress = channel.logs[0].args._channelAddress;
        await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)));
        await factory.rechargeChannel(channelAddress, new BigNumber(500).times(new BigNumber(10).pow(18)));  
        assert.strictEqual((await Token.balanceOf(channelAddress)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 500);
        let balance = new BigNumber(100).times(new BigNumber(10).pow(18));
        let hash = web3.utils.soliditySha3(receiver, balance, channelAddress);
        let sig = await web3.eth.sign(hash, accounts[0]);
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
        let Token = await TestToken.new();
        let challengePeriod = 1000;
        let factory = await Factory.new();
        let channel = await factory.createChannel(receiver, Token.address, challengePeriod);
        let channelAddress = channel.logs[0].args._channelAddress;
        await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)));
        await factory.rechargeChannel(channelAddress, new BigNumber(500).times(new BigNumber(10).pow(18)));  
        assert.strictEqual((await Token.balanceOf(channelAddress)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 500);
        let balance = new BigNumber(0).times(new BigNumber(10).pow(18));
        let hash = web3.utils.soliditySha3(receiver, balance, channelAddress);
        let sig = await web3.eth.sign(hash, accounts[0]);
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
        let Token = await TestToken.new();
        let challengePeriod = 1000;
        let factory = await Factory.new();
        let channel = await factory.createChannel(receiver, Token.address, challengePeriod);
        let channelAddress = channel.logs[0].args._channelAddress;
        await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)));
        await factory.rechargeChannel(channelAddress, new BigNumber(500).times(new BigNumber(10).pow(18)));  
        assert.strictEqual((await Token.balanceOf(channelAddress)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 500);
        let balance = new BigNumber(100).times(new BigNumber(10).pow(18));
        let hash = web3.utils.soliditySha3(receiver, balance, channelAddress);
        let sig = await web3.eth.sign(hash, accounts[0]);
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
        let Token = await TestToken.new();
        let challengePeriod = 1000;
        let factory = await Factory.new();
        let channel = await factory.createChannel(receiver, Token.address, challengePeriod);
        let channelAddress = channel.logs[0].args._channelAddress;
        assert.strictEqual(new BigNumber(await Token.balanceOf(channelAddress)).toNumber(), 0);    
        let balance = new BigNumber(100).times(new BigNumber(10).pow(18));
        let hash = web3.utils.soliditySha3(receiver, balance, channelAddress);
        let sig = await web3.eth.sign(hash, accounts[0]);
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
        let Token = await TestToken.new();
        let challengePeriod = 1000;
        let factory = await Factory.new();
        let channel = await factory.createChannel(receiver, Token.address, challengePeriod);
        let channelAddress = channel.logs[0].args._channelAddress;
        await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)));
        await factory.rechargeChannel(channelAddress, new BigNumber(500).times(new BigNumber(10).pow(18)));  
        assert.strictEqual((await Token.balanceOf(channelAddress)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 500);
        let balance = new BigNumber(501).times(new BigNumber(10).pow(18)); //501>500
        let hash = web3.utils.soliditySha3(receiver, balance, channelAddress);
        let sig = await web3.eth.sign(hash, accounts[0]);
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
        let Token = await TestToken.new();
        let challengePeriod = 1000;
        let factory = await Factory.new();
        let channel = await factory.createChannel(receiver, Token.address, challengePeriod);
        let channelAddress = channel.logs[0].args._channelAddress;
        await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)));
        await factory.rechargeChannel(channelAddress, new BigNumber(500).times(new BigNumber(10).pow(18)));  
        assert.strictEqual((await Token.balanceOf(channelAddress)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 500);
        let balance = new BigNumber(100).times(new BigNumber(10).pow(18)); 
        let hash = web3.utils.soliditySha3(receiver, balance, channelAddress);
        let sig = await web3.eth.sign(hash, accounts[2]); // signed using accounts[2]
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

    // it("channelMutualSettlement : Tokens will be transferred respectively (By Receiver)", async()=>{
    //     let Token = await TestToken.new();
    //     let challengePeriod = 400;
    //     let factory = await Factory.new();
    //     let channel = await factory.createChannel(receiver, Token.address, challengePeriod); //sender = accounts[0]
    //     let channelAddress = channel.logs[0].args._channelAddress;
        
    //     await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)));
    //     await factory.rechargeChannel(channelAddress, new BigNumber(500).times(new BigNumber(10).pow(18)));  
    //     assert.strictEqual((await Token.balanceOf(channelAddress)).dividedBy(new BigNumber(10).pow(18)).toNumber(), 500);
    //     let balance = new BigNumber(100).times(new BigNumber(10).pow(18)); 
    //     let balanceHash = web3.utils.soliditySha3(receiver, balance, channelAddress);
    //     let balanceSig = await web3.eth.sign(balanceHash, accounts[0]); 
    //     balanceSig = balanceSig.substr(2, balanceSig.length);
    //     let rbal = '0x' + balanceSig.substr(0, 64);
    //     let sbal = '0x' + balanceSig.substr(64, 64);
    //     let vbal = web3.utils.toDecimal(balanceSig.substr(128, 2)) + 27;

    //     let closingHash = web3.utils.soliditySha3(accounts[0], balance, channelAddress);
    //     let closingSig = await web3.eth.sign(closingHash, receiver); 
    //     closingSig = closingSig.substr(2, closingSig.length);
    //     let rclose = '0x' + closingSig.substr(0, 64);
    //     let sclose = '0x' + closingSig.substr(64, 64);
    //     let vclose = web3.utils.toDecimal(closingSig.substr(128, 2)) + 27;
    //     console.log(await factory.getInfo(channelAddress));
    //     await factory.channelMutualSettlement(channelAddress, balance, vbal, rbal, sbal, vclose, rclose, sclose ,{from: receiver});
    //     // assert.strictEqual(new BigNumber(await Token.balanceOf(receiver)).toNumber(), balance); 
    //     // let channelDetails = await factory.getInfo(channelAddress);
    //     // assert.strictEqual(new BigNumber(channelDetails[5]).toNumber(), 3); //status : 3 = Settled
    // });

    // it("channelMutualSettlement : Tokens will be transferred respectively (By Sender)", async()=>{
    //     let Token = await TestToken.new();
    //     let challengePeriod = 400;
    //     let factory = await Factory.new();
    //     let channel = await factory.createChannel(receiver, Token.address, challengePeriod); //sender = accounts[0]
    //     let channelAddress = channel.logs[0].args._channelAddress;
        
    //     await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)));
    //     await factory.rechargeChannel(channelAddress, 500); 
    //     assert.strictEqual(new BigNumber(await Token.balanceOf(channelAddress)).toNumber(), 500);    

    //     let balance = 100;
    //     let balanceHash = web3.sha3(
    //             web3.toHex("Sender Balance Proof Sign") +
    //             receiver.slice(2) +
    //             leftPad((balance).toString(16), 64, 0) +
    //             channelAddress.slice(2),
    //             {encoding: 'hex'});

    //     let balanceSig = web3.eth.sign(accounts[0], balanceHash);

    //     let closingHash = web3.sha3(
    //         web3.toHex("Receiver Closing Sign") +
    //         accounts[0].slice(2) +                  // sender = accounts[0]
    //         leftPad((balance).toString(16), 64, 0) +
    //         channelAddress.slice(2),
    //         {encoding: 'hex'});

    //     let closingSig = web3.eth.sign(receiver, closingHash);
    //     await factory.channelMutualSettlement(channelAddress, balance, balanceSig, closingSig, {from: accounts[0]});
    //     let channelDetails = await factory.getInfo(channelAddress);
    //     assert.strictEqual(new BigNumber(channelDetails[5]).toNumber(), 3); //status : 3 = Settled
    //     assert.strictEqual(new BigNumber(await Token.balanceOf(channelAddress)).toNumber(), 0);    
        
    // });



    // it("channelMutualSettlement : using non-contract channel Address (should fail)", async()=>{
    //     let Token = await TestToken.new();
    //     let challengePeriod = 400;
    //     let factory = await Factory.new();
    //     let channel = await factory.createChannel(receiver, Token.address, challengePeriod); //sender = accounts[0]
    //     let channelAddress = channel.logs[0].args._channelAddress;
        
    //     await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)));
    //     await factory.rechargeChannel(channelAddress, 500); 
    //     assert.strictEqual(new BigNumber(await Token.balanceOf(channelAddress)).toNumber(), 500);    

    //     let balance = 100;
    //     let balanceHash = web3.sha3(
    //             web3.toHex("Sender Balance Proof Sign") +
    //             receiver.slice(2) +
    //             leftPad((balance).toString(16), 64, 0) +
    //             channelAddress.slice(2),
    //             {encoding: 'hex'});

    //     let balanceSig = web3.eth.sign(accounts[0], balanceHash);

    //     let closingHash = web3.sha3(
    //         web3.toHex("Receiver Closing Sign") +
    //         accounts[0].slice(2) +                  // sender = accounts[0]
    //         leftPad((balance).toString(16), 64, 0) +
    //         channelAddress.slice(2),
    //         {encoding: 'hex'});

    //     let closingSig = web3.eth.sign(receiver, closingHash);
    //     try{
    //         await factory.channelMutualSettlement(testAddress1, balance, balanceSig, closingSig, {from: receiver});
    //     }catch(error){
    //         //console.log(error);
    //         Utils.ensureException(error);
    //     } 
    // });
    

    // it("channelMutualSettlement : with zero balance (should fail)", async()=>{
    //     let Token = await TestToken.new();
    //     let challengePeriod = 400;
    //     let factory = await Factory.new();
    //     let channel = await factory.createChannel(receiver, Token.address, challengePeriod); //sender = accounts[0]
    //     let channelAddress = channel.logs[0].args._channelAddress;
        
    //     await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)));
    //     await factory.rechargeChannel(channelAddress, 500); 
    //     assert.strictEqual(new BigNumber(await Token.balanceOf(channelAddress)).toNumber(), 500);    

    //     let balance = 0;
    //     let balanceHash = web3.sha3(
    //             web3.toHex("Sender Balance Proof Sign") +
    //             receiver.slice(2) +
    //             leftPad((balance).toString(16), 64, 0) +
    //             channelAddress.slice(2),
    //             {encoding: 'hex'});

    //     let balanceSig = web3.eth.sign(accounts[0], balanceHash);

    //     let closingHash = web3.sha3(
    //         web3.toHex("Receiver Closing Sign") +
    //         accounts[0].slice(2) +                  // sender = accounts[0]
    //         leftPad((balance).toString(16), 64, 0) +
    //         channelAddress.slice(2),
    //         {encoding: 'hex'});

    //     let closingSig = web3.eth.sign(receiver, closingHash);
    //     try{
    //         await factory.channelMutualSettlement(channelAddress, balance, balanceSig, closingSig, {from: receiver});
    //     }catch(error){
    //         //console.log(error);
    //         Utils.ensureException(error);
    //     }
        
    // });

    // it("channelMutualSettlement : with non-sender-receiver address (should fail)", async()=>{
    //     let Token = await TestToken.new();
    //     let challengePeriod = 400;
    //     let factory = await Factory.new();
    //     let channel = await factory.createChannel(receiver, Token.address, challengePeriod); //sender = accounts[0]
    //     let channelAddress = channel.logs[0].args._channelAddress;
        
    //     await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)));
    //     await factory.rechargeChannel(channelAddress, 500); 
    //     assert.strictEqual(new BigNumber(await Token.balanceOf(channelAddress)).toNumber(), 500);    

    //     let balance = 50;
    //     let balanceHash = web3.sha3(
    //             web3.toHex("Sender Balance Proof Sign") +
    //             receiver.slice(2) +
    //             leftPad((balance).toString(16), 64, 0) +
    //             channelAddress.slice(2),
    //             {encoding: 'hex'});

    //     let balanceSig = web3.eth.sign(accounts[0], balanceHash);

    //     let closingHash = web3.sha3(
    //         web3.toHex("Receiver Closing Sign") +
    //         accounts[0].slice(2) +                  // sender = accounts[0]
    //         leftPad((balance).toString(16), 64, 0) +
    //         channelAddress.slice(2),
    //         {encoding: 'hex'});

    //     let closingSig = web3.eth.sign(receiver, closingHash);
    //     try{
    //         await factory.channelMutualSettlement(channelAddress, balance, balanceSig, closingSig, {from: testAddress1});
    //     }catch(error){
    //         //console.log(error);
    //         Utils.ensureException(error);
    //     }
        
    // });

    // it("channelMutualSettlement : without recharging (should fail)", async()=>{
    //     let Token = await TestToken.new();
    //     let challengePeriod = 400;
    //     let factory = await Factory.new();
    //     let channel = await factory.createChannel(receiver, Token.address, challengePeriod); //sender = accounts[0]
    //     let channelAddress = channel.logs[0].args._channelAddress;
        
    //     await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)));
    //     assert.strictEqual(new BigNumber(await Token.balanceOf(channelAddress)).toNumber(), 0);    

    //     let balance = 50;
    //     let balanceHash = web3.sha3(
    //             web3.toHex("Sender Balance Proof Sign") +
    //             receiver.slice(2) +
    //             leftPad((balance).toString(16), 64, 0) +
    //             channelAddress.slice(2),
    //             {encoding: 'hex'});

    //     let balanceSig = web3.eth.sign(accounts[0], balanceHash);

    //     let closingHash = web3.sha3(
    //         web3.toHex("Receiver Closing Sign") +
    //         accounts[0].slice(2) +                  // sender = accounts[0]
    //         leftPad((balance).toString(16), 64, 0) +
    //         channelAddress.slice(2),
    //         {encoding: 'hex'});

    //     let closingSig = web3.eth.sign(receiver, closingHash);
    //     try{
    //         await factory.channelMutualSettlement(channelAddress, balance, balanceSig, closingSig, {from: receiver});
    //     }catch(error){
    //         //console.log(error);
    //         Utils.ensureException(error);
    //     }        
    // });

    // it("channelMutualSettlement : withdrawing more than deposit (should fail)", async()=>{
    //     let Token = await TestToken.new();
    //     let challengePeriod = 400;
    //     let factory = await Factory.new();
    //     let channel = await factory.createChannel(receiver, Token.address, challengePeriod); //sender = accounts[0]
    //     let channelAddress = channel.logs[0].args._channelAddress;
        
    //     await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)));
    //     await factory.rechargeChannel(channelAddress, 500); 
    //     assert.strictEqual(new BigNumber(await Token.balanceOf(channelAddress)).toNumber(), 500);    

    //     let balance = 501; // greater then 500
    //     let balanceHash = web3.sha3(
    //             web3.toHex("Sender Balance Proof Sign") +
    //             receiver.slice(2) +
    //             leftPad((balance).toString(16), 64, 0) +
    //             channelAddress.slice(2),
    //             {encoding: 'hex'});

    //     let balanceSig = web3.eth.sign(accounts[0], balanceHash);

    //     let closingHash = web3.sha3(
    //         web3.toHex("Receiver Closing Sign") +
    //         accounts[0].slice(2) +                  // sender = accounts[0]
    //         leftPad((balance).toString(16), 64, 0) +
    //         channelAddress.slice(2),
    //         {encoding: 'hex'});

    //     let closingSig = web3.eth.sign(receiver, closingHash);
    //     try{
    //         await factory.channelMutualSettlement(channelAddress, balance, balanceSig, closingSig, {from: receiver});
    //     }catch(error){
    //         //console.log(error);
    //         Utils.ensureException(error);
    //     }
    // });

    // it("channelMutualSettlement : with balance hash signed by non-sender address (should fail)", async()=>{
    //     let Token = await TestToken.new();
    //     let challengePeriod = 400;
    //     let factory = await Factory.new();
    //     let channel = await factory.createChannel(receiver, Token.address, challengePeriod); //sender = accounts[0]
    //     let channelAddress = channel.logs[0].args._channelAddress;
        
    //     await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)));
    //     await factory.rechargeChannel(channelAddress, 500); 
    //     assert.strictEqual(new BigNumber(await Token.balanceOf(channelAddress)).toNumber(), 500);    

    //     let balance = 200; // greater then 500
    //     let balanceHash = web3.sha3(
    //             web3.toHex("Sender Balance Proof Sign") +
    //             receiver.slice(2) +
    //             leftPad((balance).toString(16), 64, 0) +
    //             channelAddress.slice(2),
    //             {encoding: 'hex'});

    //     let balanceSig = web3.eth.sign(testAddress1, balanceHash);

    //     let closingHash = web3.sha3(
    //         web3.toHex("Receiver Closing Sign") +
    //         testAddress1.slice(2) +                  // sender = accounts[0]
    //         leftPad((balance).toString(16), 64, 0) +
    //         channelAddress.slice(2),
    //         {encoding: 'hex'});

    //     let closingSig = web3.eth.sign(receiver, closingHash);
    //     try{
    //         await factory.channelMutualSettlement(channelAddress, balance, balanceSig, closingSig, {from: receiver});
    //     }catch(error){
    //         //console.log(error);
    //         Utils.ensureException(error);
    //     }        
    // });

    // it("channelMutualSettlement : with closing hash signed by non-receiver address (should fail)", async()=>{
    //     let Token = await TestToken.new();
    //     let challengePeriod = 400;
    //     let factory = await Factory.new();
    //     let channel = await factory.createChannel(receiver, Token.address, challengePeriod); //sender = accounts[0]
    //     let channelAddress = channel.logs[0].args._channelAddress;
        
    //     await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)));
    //     await factory.rechargeChannel(channelAddress, 500); 
    //     assert.strictEqual(new BigNumber(await Token.balanceOf(channelAddress)).toNumber(), 500);    

    //     let balance = 200; // greater then 500
    //     let balanceHash = web3.sha3(
    //             web3.toHex("Sender Balance Proof Sign") +
    //             receiver.slice(2) +
    //             leftPad((balance).toString(16), 64, 0) +
    //             channelAddress.slice(2),
    //             {encoding: 'hex'});

    //     let balanceSig = web3.eth.sign(accounts[0], balanceHash);

    //     let closingHash = web3.sha3(
    //         web3.toHex("Receiver Closing Sign") +
    //         accounts[0].slice(2) +                  // sender = accounts[0]
    //         leftPad((balance).toString(16), 64, 0) +
    //         channelAddress.slice(2),
    //         {encoding: 'hex'});

    //     let closingSig = web3.eth.sign(testAddress1, closingHash);
    //     try{
    //         await factory.channelMutualSettlement(channelAddress, balance, balanceSig, closingSig, {from: receiver});
    //     }catch(error){
    //         //console.log(error);
    //         Utils.ensureException(error);
    //     }        
    // });

    // it("channelChallengedSettlement : Challenge Period will be started", async()=>{
    //     let Token = await TestToken.new();
    //     let challengePeriod = 400;
    //     let factory = await Factory.new();
    //     let channel = await factory.createChannel(receiver, Token.address, challengePeriod); //sender = accounts[0]
    //     let channelAddress = channel.logs[0].args._channelAddress;
        
    //     await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)));
    //     await factory.rechargeChannel(channelAddress, 500); 
    //     assert.strictEqual(new BigNumber(await Token.balanceOf(channelAddress)).toNumber(), 500);    

    //     let balance = 100;        
    //     await factory.channelChallengedSettlement(channelAddress, balance,{from: accounts[0]});
    //     let challengeDetails = await factory.getChallengeDetails(channelAddress);
    //     assert.strictEqual(new BigNumber(challengeDetails[2]).toNumber(), balance); 
    //     assert.strictEqual(new BigNumber(challengeDetails[1]).toNumber(), challengePeriod); 
    //     let channelDetails = await factory.getInfo(channelAddress);
    //     assert.strictEqual(new BigNumber(channelDetails[5]).toNumber(), 2); //status : 2 = InChallenge
    // });

    // it("channelChallengedSettlement : with non-contract channel address (should fail)", async()=>{
    //     let Token = await TestToken.new();
    //     let challengePeriod = 400;
    //     let factory = await Factory.new();
    //     let channel = await factory.createChannel(receiver, Token.address, challengePeriod); //sender = accounts[0]
    //     let channelAddress = channel.logs[0].args._channelAddress;
        
    //     await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)));
    //     await factory.rechargeChannel(channelAddress, 500); 
    //     assert.strictEqual(new BigNumber(await Token.balanceOf(channelAddress)).toNumber(), 500);    

    //     let balance = 100;
    //     try{
    //         await factory.channelChallengedSettlement(testAddress1, balance,{from: accounts[0]});
    //     }catch(error){
    //         //console.log(error);
    //         Utils.ensureException(error);
    //     }       
    // });

    // it("channelChallengedSettlement : with zero balance (should fail)", async()=>{
    //     let Token = await TestToken.new();
    //     let challengePeriod = 400;
    //     let factory = await Factory.new();
    //     let channel = await factory.createChannel(receiver, Token.address, challengePeriod); //sender = accounts[0]
    //     let channelAddress = channel.logs[0].args._channelAddress;
        
    //     await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)));
    //     await factory.rechargeChannel(channelAddress, 500); 
    //     assert.strictEqual(new BigNumber(await Token.balanceOf(channelAddress)).toNumber(), 500);    

    //     let balance = 0;
    //     try{
    //         await factory.channelChallengedSettlement(channelAddress, balance,{from: accounts[0]});
    //     }catch(error){
    //         //console.log(error);
    //         Utils.ensureException(error);
    //     }       
    // });

    // it("channelChallengedSettlement : with non-sender address (should fail)", async()=>{
    //     let Token = await TestToken.new();
    //     let challengePeriod = 400;
    //     let factory = await Factory.new();
    //     let channel = await factory.createChannel(receiver, Token.address, challengePeriod); //sender = accounts[0]
    //     let channelAddress = channel.logs[0].args._channelAddress;
        
    //     await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)));
    //     await factory.rechargeChannel(channelAddress, 500); 
    //     assert.strictEqual(new BigNumber(await Token.balanceOf(channelAddress)).toNumber(), 500);    

    //     let balance = 50;
    //     try{
    //         await factory.channelChallengedSettlement(channelAddress, balance,{from: testAddress1});
    //     }catch(error){
    //         //console.log(error);
    //         Utils.ensureException(error);
    //     }       
    // });

    // it("channelChallengedSettlement : without recharging channel (should fail)", async()=>{
    //     let Token = await TestToken.new();
    //     let challengePeriod = 400;
    //     let factory = await Factory.new();
    //     let channel = await factory.createChannel(receiver, Token.address, challengePeriod); //sender = accounts[0]
    //     let channelAddress = channel.logs[0].args._channelAddress;
        
    //     await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)));
    //     assert.strictEqual(new BigNumber(await Token.balanceOf(channelAddress)).toNumber(), 0);    

    //     let balance = 50;
    //     try{
    //         await factory.channelChallengedSettlement(channelAddress, balance,{from: accounts[0]});
    //     }catch(error){
    //         //console.log(error);
    //         Utils.ensureException(error);
    //     }       
    // });

    // it("channelChallengedSettlement : with balance more than deposit (should fail)", async()=>{
    //     let Token = await TestToken.new();
    //     let challengePeriod = 400;
    //     let factory = await Factory.new();
    //     let channel = await factory.createChannel(receiver, Token.address, challengePeriod); //sender = accounts[0]
    //     let channelAddress = channel.logs[0].args._channelAddress;
        
    //     await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)));
    //     await factory.rechargeChannel(channelAddress, 500); 
    //     assert.strictEqual(new BigNumber(await Token.balanceOf(channelAddress)).toNumber(), 500);    

    //     let balance = 501;
    //     try{
    //         await factory.channelChallengedSettlement(channelAddress, balance,{from: accounts[0]});
    //     }catch(error){
    //         //console.log(error);
    //         Utils.ensureException(error);
    //     }       
    // });

    // it("channelChallengedSettlement : receiver trying to withdraw during challenge period (should fail)", async()=>{
    //     let Token = await TestToken.new();
    //     let challengePeriod = 400;
    //     let factory = await Factory.new();
    //     let channel = await factory.createChannel(receiver, Token.address, challengePeriod); //sender = accounts[0]
    //     let channelAddress = channel.logs[0].args._channelAddress;
        
    //     await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)));
    //     await factory.rechargeChannel(channelAddress, 500); 
    //     assert.strictEqual(new BigNumber(await Token.balanceOf(channelAddress)).toNumber(), 500);    

    //     let balance = 100;
    //     await factory.channelChallengedSettlement(channelAddress, balance,{from: accounts[0]});

    //     let hash = web3.sha3(
    //         web3.toHex("Sender Balance Proof Sign") +
    //         receiver.slice(2) +
    //         leftPad((50).toString(16), 64, 0) +
    //         channelAddress.slice(2),
    //         {encoding: 'hex'});

    //     let sig = web3.eth.sign(accounts[0], hash);
    //     try{
    //         await factory.withdrawFromChannel(channelAddress, 50, sig, {from: receiver});
    //     }catch(error){
    //         //console.log(error);
    //         Utils.ensureException(error);
    //     }       
    // });

    // it("channelChallengedSettlement : mutual settlement by receiver after initiation of challenge period", async()=>{
    //     let Token = await TestToken.new();
    //     let challengePeriod = 400;
    //     let factory = await Factory.new();
    //     let channel = await factory.createChannel(receiver, Token.address, challengePeriod); //sender = accounts[0]
    //     let channelAddress = channel.logs[0].args._channelAddress;
        
    //     await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)));
    //     await factory.rechargeChannel(channelAddress, 500); 
    //     assert.strictEqual(new BigNumber(await Token.balanceOf(channelAddress)).toNumber(), 500);    

    //     let balance = 100;
    //     await factory.channelChallengedSettlement(channelAddress, balance,{from: accounts[0]});

    //     let balanceHash = web3.sha3(
    //             web3.toHex("Sender Balance Proof Sign") +
    //             receiver.slice(2) +
    //             leftPad((balance).toString(16), 64, 0) +
    //             channelAddress.slice(2),
    //             {encoding: 'hex'});

    //     let balanceSig = web3.eth.sign(accounts[0], balanceHash);

    //     let closingHash = web3.sha3(
    //         web3.toHex("Receiver Closing Sign") +
    //         accounts[0].slice(2) +                  // sender = accounts[0]
    //         leftPad((balance).toString(16), 64, 0) +
    //         channelAddress.slice(2),
    //         {encoding: 'hex'});

    //     let closingSig = web3.eth.sign(receiver, closingHash);
    //     await factory.channelMutualSettlement(channelAddress, balance, balanceSig, closingSig, {from: receiver});
    //     assert.strictEqual(new BigNumber(await Token.balanceOf(receiver)).toNumber(), balance); 
    //     let channelDetails = await factory.getInfo(channelAddress);
    //     assert.strictEqual(new BigNumber(channelDetails[5]).toNumber(), 3); //status: 3 = settled
    // });

    // it("channelAfterChallengeSettlement : channel will be settled by sender after challengePeriod", async()=>{
    //     let Token = await TestToken.new();
    //     let challengePeriod = 400;
    //     let factory = await Factory.new();
    //     let channel = await factory.createChannel(receiver, Token.address, challengePeriod, {from: testAddress1}); //sender = accounts[0]
    //     let channelAddress = channel.logs[0].args._channelAddress;

    //     await Token.transfer(testAddress1, 700); 
    //     assert.strictEqual(new BigNumber(await Token.balanceOf(testAddress1)).toNumber(), 700); 
    //     await Token.approve(channelAddress, new BigNumber(600).times(new BigNumber(10).pow(18)),{from: testAddress1});
    //     await factory.rechargeChannel(channelAddress, 500, {from: testAddress1}); 
    //     assert.strictEqual(new BigNumber(await Token.balanceOf(channelAddress)).toNumber(), 500);    

    //     let balance = 100;
    //     await factory.channelChallengedSettlement(channelAddress, balance,{from: testAddress1});
    //     assert.strictEqual(new BigNumber(await Token.balanceOf(testAddress1)).toNumber(), 200); // 700-500 = 200 
    //     time.increaseTime(410); // ensure challengePeriod is passed 
    //     await factory.channelAfterChallengeSettlement(channelAddress, {from: testAddress1});
    //     assert.strictEqual(new BigNumber(await Token.balanceOf(receiver)).toNumber(), balance); 
    //     assert.strictEqual(new BigNumber(await Token.balanceOf(testAddress1)).toNumber(), 600); // 200+(500-100) = 600   
    //     let channelDetails = await factory.getInfo(channelAddress);
    //     assert.strictEqual(new BigNumber(channelDetails[5]).toNumber(), 3); //status: 3 = settled    
    // });

    // it("channelAfterChallengeSettlement : with non-contract channel address (should fail)", async()=>{
        
    //     let Token = await TestToken.new();
    //     let challengePeriod = 400;
    //     let factory = await Factory.new();
    //     let channel = await factory.createChannel(receiver, Token.address, challengePeriod); //sender = accounts[0]
    //     let channelAddress = channel.logs[0].args._channelAddress;
        
    //     await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)));
    //     await factory.rechargeChannel(channelAddress, 500); 
    //     assert.strictEqual(new BigNumber(await Token.balanceOf(channelAddress)).toNumber(), 500);    

    //     let balance = 100;
    //     await factory.channelChallengedSettlement(channelAddress, balance,{from: accounts[0]});
    //     time.increaseTime(410); // To ensure challengePeriod is passed 
    //     try{
    //         await factory.channelAfterChallengeSettlement(testAddress1, {from: accounts[0]});     
    //     }catch(error){
    //         //console.log(error);
    //         Utils.ensureException(error);
    //     }        
    // });

    // it("channelAfterChallengeSettlement : with non-sender address (should fail)", async()=>{

    //     let Token = await TestToken.new();
    //     let challengePeriod = 400;
    //     let factory = await Factory.new();
    //     let channel = await factory.createChannel(receiver, Token.address, challengePeriod); //sender = accounts[0]
    //     let channelAddress = channel.logs[0].args._channelAddress;
        
    //     await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)));
    //     await factory.rechargeChannel(channelAddress, 500); 
    //     assert.strictEqual(new BigNumber(await Token.balanceOf(channelAddress)).toNumber(), 500);    

    //     let balance = 100;
    //     await factory.channelChallengedSettlement(channelAddress, balance,{from: accounts[0]});
    //     time.increaseTime(410); // To ensure challengePeriod is passed 
    //     try{
    //         await factory.channelAfterChallengeSettlement(channelAddress, {from: testAddress1});     
    //     }catch(error){
    //         //console.log(error);
    //         Utils.ensureException(error);
    //     }        
    // });

    // it("channelAfterChallengeSettlement : without triggering challenge period (should fail)", async()=>{
    //     let Token = await TestToken.new();
    //     let challengePeriod = 400;
    //     let factory = await Factory.new();
    //     let channel = await factory.createChannel(receiver, Token.address, challengePeriod); //sender = accounts[0]
    //     let channelAddress = channel.logs[0].args._channelAddress;
        
    //     await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)));
    //     await factory.rechargeChannel(channelAddress, 500); 
    //     assert.strictEqual(new BigNumber(await Token.balanceOf(channelAddress)).toNumber(), 500);    

    //     let balance = 100; 
    //     try{
    //         await factory.channelAfterChallengeSettlement(channelAddress);     
    //     }catch(error){
    //         //console.log(error);
    //         Utils.ensureException(error);
    //     }        
    // });

    // it("channelAfterChallengeSettlement : during challenge period (should fail)", async()=>{
    //     let Token = await TestToken.new();
    //     let challengePeriod = 400;
    //     let factory = await Factory.new();
    //     let channel = await factory.createChannel(receiver, Token.address, challengePeriod); //sender = accounts[0]
    //     let channelAddress = channel.logs[0].args._channelAddress;
        
    //     await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)));
    //     await factory.rechargeChannel(channelAddress, 500); 
    //     assert.strictEqual(new BigNumber(await Token.balanceOf(channelAddress)).toNumber(), 500);    

    //     let balance = 100;
    //     await factory.channelChallengedSettlement(channelAddress, balance,{from: accounts[0]}); 
    //     try{
    //         await factory.channelAfterChallengeSettlement(channelAddress);     
    //     }catch(error){
    //         //console.log(error);
    //         Utils.ensureException(error);
    //     }        
    // });

    // it("getAllChannelsAsSender :all channel addresses as sender will be returned", async()=>{
    //     let Token = await TestToken.new();
    //     let challengePeriod = 400;
    //     let factory = await Factory.new();
    //     let channel1 = await factory.createChannel(receiver, Token.address, challengePeriod); //sender = accounts[0]
    //     let channelAddress1 = channel1.logs[0].args._channelAddress;

    //     let channel2 = await factory.createChannel(testAddress2, Token.address, challengePeriod); //sender = accounts[0]
    //     let channelAddress2 = channel2.logs[0].args._channelAddress;

    //     let allchannels = await factory.getAllChannelsAsSender();
        
    //     assert.strictEqual(allchannels[0], channelAddress1); 
    //     assert.strictEqual(allchannels[1], channelAddress2); 
    //     assert.strictEqual(allchannels.length, 2);                
    // });

    // it("getAllChannelsAsReceiver : all channel addresses as receiver will be returned", async()=>{
    //     let Token = await TestToken.new();
    //     let challengePeriod = 400;
    //     let factory = await Factory.new();
    //     let channel1 = await factory.createChannel(receiver, Token.address, challengePeriod); //sender = accounts[0]
    //     let channelAddress1 = channel1.logs[0].args._channelAddress;

    //     let channel2 = await factory.createChannel(receiver, Token.address, challengePeriod); //sender = accounts[0]
    //     let channelAddress2 = channel2.logs[0].args._channelAddress;

    //     let allchannels = await factory.getAllChannelsAsReceiver({from: receiver});
        
    //     assert.strictEqual(allchannels[0], channelAddress1); 
    //     assert.strictEqual(allchannels[1], channelAddress2); 
    //     assert.strictEqual(allchannels.length, 2);                
    // });


});