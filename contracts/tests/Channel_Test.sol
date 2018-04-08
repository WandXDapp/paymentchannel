pragma solidity ^0.4.18;


import "./../lib/SafeMath.sol";
import "./../token/Token.sol";

contract Channel {

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

    enum State {Initiated, Recharged, Withdrawn, InChallenge, Settled }
    State status;

    Token public token;

    /*
     * modifiers
     */

    modifier onlyFactory() {
        require(msg.sender == factory);
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
    onlyFactory  
    returns (bool)
    {
        require(token.transferFrom(sender, address(this), _deposit));
        depositedBalance = depositedBalance + _deposit;
        status = State.Recharged;
        return true;
    }

    /**
     * @dev `withdraw` to withdraw tokens from channel only once 
     * @param _balance no. of tokens to withdraw
     * @param _vbal v of signedBalanceHash
     * @param _rbal r of signedBalanceHash
     * @param _sbal s of signedBalanceHash
     * @return bool 
     */
    function withdraw(uint _balance, uint8 _vbal, bytes32 _rbal, bytes32 _sbal)
    external
    onlyFactory
    returns (bool)
    {
        require(status == State.Recharged);
        require(_balance <= depositedBalance);                
        require(extractBalanceProofSignature(receiver, _balance, _vbal, _rbal, _sbal));
        // Update total withdrawn balance
        withdrawnBalance = _balance;
        status = State.Withdrawn;
        require(token.transfer(receiver, _balance));
        return true;
    }
    
    /**
     * @dev `mutualSettlement` to settle channel with mutual consent
     * @param _balance no. of tokens to withdraw
     * @param _vbal v of signedBalanceHash
     * @param _rbal r of signedBalanceHash
     * @param _sbal s of signedBalanceHash
     * @param _vclose v of signedClosingHash
     * @param _rclose r of signedClosingHash
     * @param _sclose s of signedClosingHash
     * @return bool 
     */
    function mutualSettlement(uint _balance, uint8 _vbal, bytes32 _rbal, bytes32 _sbal, uint8 _vclose, bytes32 _rclose, bytes32 _sclose)
    external
    onlyFactory
    returns (bool)
    {
        require(status != State.Settled);
        require(_balance <= depositedBalance);
        require(extractBalanceProofSignature(receiver, _balance, _vbal, _rbal, _sbal));
        require(extractClosingSignature(sender, _balance, _vclose, _rclose, _sclose));
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
    onlyFactory
    returns (bool)
    {
        require(status == State.Recharged || status == State.Withdrawn);
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
    onlyFactory
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
        return( challengeStartTime,
                challengePeriod,
                balanceInChallenge
        );
    }
    
    /**
     * @dev `extractBalanceProofSignature` to extract signer of signed Hash 
     * @param _receiverAddress address of receiver 
     * @param _balance no. of tokens for which hash is signed 
     * @param _v v of signedBalanceHash
     * @param _r r of signedBalanceHash
     * @param _s s of signedBalanceHash   
     * @return bool 
     */
    function extractBalanceProofSignature(address _receiverAddress, uint256 _balance, uint8 _v, bytes32 _r, bytes32 _s)
    internal view
    returns (bool)
    {
        bytes32 msgHash = keccak256(_receiverAddress, _balance, address(this));
        require(ecrecover(keccak256("\x19Ethereum Signed Message:\n32", msgHash), _v, _r, _s) == sender);
        return true;
    }

    /**
     * @dev `extractClosingSignature` to extract signer of closing Hash 
     * @param _senderAddress address of sender 
     * @param _balance no. of tokens for which hash is signed
     * @param _v v of signedClosingHash
     * @param _r r of signedClosingHash
     * @param _s s of signedClosingHash    
     * @return bool 
     */
    function extractClosingSignature(address _senderAddress, uint _balance, uint8 _v, bytes32 _r, bytes32 _s)
    internal view
    returns (bool)
    {
        bytes32 msgHash = keccak256(_senderAddress, _balance, address(this));
        require(ecrecover(keccak256("\x19Ethereum Signed Message:\n32", msgHash), _v, _r, _s) == receiver);
        return true;
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
        status = State.Settled;
        require(token.transfer(_receiverAddress, _balance.sub(withdrawnBalance)));

        // Send remaining tokens back to sender
        var remainingTokens = depositedBalance.sub(_balance);
        if(remainingTokens > 0)
        {
            require(token.transfer(_senderAddress, remainingTokens));
        }
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