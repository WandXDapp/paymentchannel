const ECV = artifacts.require('ECVerification.sol');
const Factory = artifacts.require('Factory.sol');
const TestToken = artifacts.require('TestToken.sol');
const ethers = require('ethers');
const utils = ethers.utils;
const Utils = require('./helpers/utils');
import latestTime from './helpers/latestTime';
import leftPad from 'left-pad';
const BigNumber = require('bignumber.js');


contract('Factory', (accounts) => {
    
    let receiver;
    let sender;
    let testAddress1;
    let testAddress2;    

    before(async() => {
        receiver = accounts[1];
        testAddress1 = accounts[2];
        testAddress2 = accounts[3];
    });

    Number.prototype.pad = function(size) {
        var s = String(this);
        while (s.length < (size || 2)) {s = "0" + s;}
        return s;
      }
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

        await factory.rechargeChannel(channelAddress, 500); 
        assert.strictEqual(new BigNumber(await Token.balanceOf(channelAddress)).toNumber(), 500);
        
        let channelDetails = await factory.getInfo(channelAddress);        

        assert.strictEqual(new BigNumber(channelDetails[5]).toNumber(), 1); //status : 1 = Recharged
    });

    it("rechargeChannel : with non-contract channel address (should fail)", async()=>{
        let Token = await TestToken.new();
        let challengePeriod = 500;
        let factory = await Factory.new();
        let channel = await factory.createChannel(receiver, Token.address, challengePeriod);
        let channelAddress = channel.logs[0].args._channelAddress;
        try{
            await factory.rechargeChannel(testAddress1, 500);      
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
            await factory.rechargeChannel(channelAddress, 500); 
        }catch(error){
            //console.log(error);
            Utils.ensureException(error);
        }        
    });

    it("withdrawFromChannel : Approved tokens will be transferred to channel", async()=>{
        let Token = await TestToken.new();
        let challengePeriod = 400;
        let factory = await Factory.new();
        let channel = await factory.createChannel(receiver, Token.address, challengePeriod);
        let channelAddress = channel.logs[0].args._channelAddress;
        let channelDetails = await factory.getInfo(channelAddress);
        
        await Token.approve(channelAddress, new BigNumber(1000).times(new BigNumber(10).pow(18)));
        await factory.rechargeChannel(channelAddress, 500); 
        assert.strictEqual(new BigNumber(await Token.balanceOf(channelAddress)).toNumber(), 500);    

        let hash = web3.sha3(
                web3.toHex("Sender Balance Proof Sign") +
                receiver.slice(2) +
                leftPad((100).toString(16), 64, 0) +
                channelAddress.slice(2),
                {encoding: 'hex'});

        let sig = web3.eth.sign(accounts[0], hash);
        await factory.withdrawFromChannel(channelAddress, 100, sig, {from: receiver});
        let channelDetails2 = await factory.getInfo(channelAddress);      
        assert.strictEqual(new BigNumber(await Token.balanceOf(receiver)).toNumber(), 100); 
    });

});