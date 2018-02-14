const ECV = artifacts.require('ECVerification.sol');
const Channel = artifacts.require('Channel.sol');
const TestToken = artifacts.require('TestToken.sol');
const Utils = require('./helpers/utils');
import latestTime from './helpers/latestTime';
const BigNumber = require('bignumber.js');


contract('Channel', (accounts) => {
    
    let receiver;
    let sender;
    let testAddress1;
    let testAddress2;    

    before(async() => {
        receiver = accounts[1];
        testAddress1 = accounts[2];
        testAddress2 = accounts[3];
    });

    it("Verify constructors", async()=>{
        let Token = await TestToken.new();
        let challengePeriod = 500;
        let channel = await Channel.new(receiver, Token.address, challengePeriod);
        
        let challengeTime = await channel.challengePeriod();
        assert.strictEqual(new BigNumber(challengeTime).toNumber(), challengePeriod);

        let status = await channel.status();
        assert.strictEqual(new BigNumber(status).toNumber(), 0); //0 = Initiated
        
        assert.strictEqual(await channel.sender(), accounts[0]); // accounts[0] = default
        assert.strictEqual(await channel.receiver(), receiver);
        
        let startTimestamp = await channel.startDate();
        assert.equal(new BigNumber(startTimestamp).toNumber(), latestTime());
    });


    it("Verify constructors with invalid receiver address (should fail)", async()=>{
        let Token = await TestToken.new();
        let challengePeriod = 500;
        try{
            let channel = await Channel.new("0x0", Token.address, challengePeriod);
        }catch(error){
            //console.log(error);
            Utils.ensureException(error);
        }        
    });

    it("Verify constructors with non-contract token address (should fail)", async()=>{
        let challengePeriod = 500;
        try{
            let channel = await Channel.new(receiver, testAddress1, challengePeriod);
        }catch(error){
            //console.log(error);
            Utils.ensureException(error);
        }        
    });

    it("Verify constructors with no challenge Period (should fail)", async()=>{
        let Token = await TestToken.new();
        let challengePeriod = 0;
        try{
            let channel = await Channel.new(receiver, Token.address, challengePeriod);
        }catch(error){
            //console.log(error);
            Utils.ensureException(error);
        }        
    });

    it("Recharge channel with approved token", async() => {
        let Token = await TestToken.new();
        let challengePeriod = 500;
        let channel = await Channel.new(receiver, Token.address, challengePeriod);

        await Token.approve(channel.address, 100);
        assert.strictEqual(new BigNumber(await Token.allowance(accounts[0], channel.address)).toNumber(), 100);
        await channel.recharge(100);
        assert.strictEqual(new BigNumber(await Token.balanceOf(channel.address)).toNumber(), 100);
        assert.strictEqual(new BigNumber(await channel.status()).toNumber(), 1); //1 = Recharged        
    })

});