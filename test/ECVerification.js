const ECV = artifacts.require('ECVerification.sol');
const Utils = require('./helpers/utils');


contract('ECVerification', (accounts) => {  

    it('ecverify : should return signing address from signature', async () => {
            let ECVerification = await ECV.new();
            let msg = 'Test String';
            let hash = web3.sha3(msg);
            let sig = web3.eth.sign(accounts[1], hash);
            let signer = await ECVerification.ecverify(hash, sig);
            assert.strictEqual(signer, accounts[1]);
    });

    it('ecverify : with signature length less than 65 (should fail)', async () => {
        let ECVerification = await ECV.new();
        let msg = 'Test String';
        let hash = web3.sha3(msg);
        let sig = "0x30b0b6f85ef3a988680ed0e52f578a27b96f3f9ed4c84eb618d717acee619cb261727ce26f14723596ed1433fb8c8a27171d1ea30c095556f36f0ecae582a5c4";
        try{
            await ECVerification.ecverify(hash, sig);
        }catch(error){
            //console.log(error);
            Utils.ensureException(error);
        }     
    });
});