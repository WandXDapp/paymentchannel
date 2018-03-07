pragma solidity ^0.4.18;


import "./lib/safeMath.sol";
import "./token/Token.sol";
import "./ECVerification.sol";

contract Channel is ECVerification {

    using SafeMath for uint256;

    address factory;
    address public sender;
    address public receiver;
    uint public challengePeriod;
    uint public startDate;
    uint challengeStartTime;

    uint depositedBalance = 0;
    uint withdrawnBalance = 0;
    uint balanceInChallenge = 0;

    enum State {Initiated, Recharged, InChallenge, Settled }
    State status;

    Token public token;

    /*
     * modifiers
     */

    modifier onlyFactory() {
        require(msg.sender == factory);
        _;
    }

    modifier originReceiver() {
        require(tx.origin == receiver);
        _;
    }

    modifier originSender() {
        require(tx.origin == sender);
        _;
    }

    modifier originSenderOrReceiver() {
        require(tx.origin == sender || tx.origin == receiver);
        _;
    }

    /**
     * @dev `constructor`
     */
    function Channel(address _receiver, address _sender, address _tokenAddress, uint _challengePeriod) 
    public
    {       
        token = Token(_tokenAddress);
        require(token.totalSupply() > 0);
        receiver = _receiver;
        sender = _sender; 
        factory = msg.sender; 
        require(addressHasCode(factory));      
        challengePeriod = _challengePeriod;
        startDate = now;
        status = State.Initiated;
    }

    /**
     * @dev `recharge` to recharge channel once or multiple times
     * @param _deposit no. of tokens
     * @return bool 
     */
    function recharge(uint _deposit) 
    external 
    onlyFactory originSender 
    returns (bool)
    {
        require(token.allowance(sender, address(this)) >= _deposit);
        require(token.transferFrom(sender, address(this), _deposit));
        depositedBalance = _deposit;
        status = State.Recharged;

        return true;
    }

    /**
     * @dev `withdraw` to withdraw tokens from channel once or multiple times
     * @param _balance no. of tokens to withdraw
     * @param _signedBalanceMsg balance hash signed by sender
     * @return bool 
     */
    function withdraw(uint _balance, bytes _signedBalanceMsg)
    external
    originReceiver onlyFactory
    returns (bool)
    {
        require(status == State.Recharged);
        require(_balance <= depositedBalance.sub(withdrawnBalance));
                
        // Derive sender address from signed balance proof
        address senderAddress = extractBalanceProofSignature(
            receiver,
            _balance,
            _signedBalanceMsg
        );
        require(senderAddress == sender);
        // Update total withdrawn balance
        withdrawnBalance = withdrawnBalance.add(_balance);

        // Send the remaining balance to the receiver
        require(token.transfer(receiver, _balance));
        return true;
    }
    
    /**
     * @dev `mutualSettlement` to settle channel with mutual consent
     * @param _signedBalanceMsg balance hash signed by sender
     * @param _signedClosingMsg closing hash signed by receiver
     * @return bool 
     */
    function mutualSettlement(uint _balance, bytes _signedBalanceMsg, bytes _signedClosingMsg)
    external
    originSenderOrReceiver onlyFactory
    returns (bool)
    {
        require(status == State.Recharged || status == State.InChallenge);
        require(_balance <= depositedBalance.sub(withdrawnBalance));
        
        // Derive sender address from signed balance proof
        address senderAddr = extractBalanceProofSignature(
            receiver,
            _balance,
            _signedBalanceMsg
        );
        require(senderAddr == sender);
        // Derive receiver address from closing signature
        address receiverAddr = extractClosingSignature(
            senderAddr,
            _balance,
            _signedClosingMsg
        );
        require(receiverAddr == receiver);

        // Both signatures have been verified and the channel can be settled.
        require(settleChannel(sender, receiver, _balance));
        return true;
    }

    /**
     * @dev `challengedSettlement` to start challenge period of channel
     * @param _balance total balance allocated to receiver
     * @return bool 
     */
    function challengedSettlement(uint _balance)
    external
    originSender onlyFactory
    returns (bool)
    {
        require(status == State.Recharged);
        require(_balance <= depositedBalance);

        challengeStartTime = now;
        status = State.InChallenge;
        balanceInChallenge = _balance;
        return true;
    }
    
    /**
     * @dev `afterChallengeSettle` to settle channel after challenge period 
     * @return _balance 
     */
    function afterChallengeSettle() 
    external 
    originSender onlyFactory
    returns (uint)
    {
        require(status == State.InChallenge); 
        require(now > challengeStartTime + challengePeriod * 1 seconds);  

        require(settleChannel(sender, receiver, balanceInChallenge));
        return balanceInChallenge;
    }    

    /**
     * @dev `getChannelInfo` to get channel information any time 
     * @return complete details 
     */
    function getChannelInfo() onlyFactory external view returns (address, address, address, uint, uint, State, uint, uint){
        return( sender,
                receiver,
                token,
                challengePeriod,
                startDate,
                status,
                depositedBalance,
                withdrawnBalance
                );
    }

    /**
     * @dev `getChallengeInfo` to get active challenge information  
     * @return challenge parameters 
     */
    function getChallengeInfo() onlyFactory external view returns (uint, uint, uint) {
        require(status == State.InChallenge);
        return( challengeStartTime,
                challengePeriod,
                balanceInChallenge
                );
    }
    
    /**
     * @dev `extractBalanceProofSignature` to extract signer of signed Hash 
     * @param _receiverAddress address of receiver 
     * @param _balance no. of tokens for which hash is signed 
     * @param _signedBalanceMsg signed balance message    
     * @return challenge parameters 
     */
    function extractBalanceProofSignature(address _receiverAddress, uint256 _balance, bytes _signedBalanceMsg)
    internal view
    returns (address)
    {
        bytes32 msgHash = keccak256(
                "Sender Balance Proof Sign",
                _receiverAddress,
                _balance,
                address(this)   
            );

        // Derive address from signature
        address signer = ecverify(msgHash, _signedBalanceMsg);
        return signer;
    }

    /**
     * @dev `extractClosingSignature` to extract signer of closing Hash 
     * @param _senderAddress address of sender 
     * @param _balance no. of tokens for which hash is signed 
     * @param _signedClosingMsg signed balance message    
     * @return signer address 
     */
    function extractClosingSignature(address _senderAddress, uint _balance, bytes _signedClosingMsg)
    internal view
    returns (address)
    {
        bytes32 msgHash = keccak256(
                "Receiver Closing Sign",
                _senderAddress,
                _balance,
                address(this)
            );

        // Derive address from signature
        address signer = ecverify(msgHash, _signedClosingMsg);
        return signer;
    } 

    /**
     * @dev `settleChannel` to settle channel 
     * @param _senderAddress address of sender 
     * @param _receiverAddress address of receiver 
     * @param _balance no. of tokens for which hash is signed    
     * @return bool 
     */
    function settleChannel(address _senderAddress, address _receiverAddress, uint _balance)
    internal 
    returns (bool)
    {
        // Send the unwithdrawn _balance to the receiver
        uint receiverRemainingTokens = _balance.sub(withdrawnBalance);
        withdrawnBalance = withdrawnBalance + receiverRemainingTokens; 
        status = State.Settled;
        require(token.transfer(_receiverAddress, receiverRemainingTokens));

        // Send remaining tokens back to sender
        require(token.transfer(_senderAddress, depositedBalance.sub(receiverRemainingTokens)));
        return true;
    }

    /**
     * @dev `addressHasCode` to check if address is a contract address
     * @param _contract address to check
     * @return bool
     */
    function addressHasCode(address _contract) internal view returns (bool) {
        uint size;
        assembly {
            size := extcodesize(_contract)
        }
        return size > 0;
    }

}