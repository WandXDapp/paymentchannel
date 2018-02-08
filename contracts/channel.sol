pragma solidity ^0.4.18;

import './lib/ecverification.sol';
import './lib/safeMath.sol';
import './token/token.sol';

contract Channel {

    using SafeMath for uint256;

    uint public challengePeriod;
    address public sender;
    address public receiver;
    uint startDate;
    uint challengeStartTime;

    uint depositedBalance = 0;
    uint withdrawnBalance = 0;
    uint balanceInChallenge = 0;

    enum State {Initiated, Recharged, InChallenge, Settled }
    State status;

    Token public token;

    modifier onlySender() {
        require(msg.sender == sender);
        _;
    }

    modifier onlyReceiver() {
        require(msg.sender == receiver);
        _;
    }

    modifier nonZero(uint param) {
        require(param > 0);
        _;
    }

    modifier nonZeroAddress(address addr) {
        require(addr != address(0));
        _;
    }

    event ChannelRecharged(
        address indexed _senderAddress,
        address indexed _receiverAddress,
        uint _deposit);

    event ChannelWithdraw(
        address indexed _senderAddress,
        address indexed _receiverAddress,
        uint _withdrawnBalance);

    event ChannelSettled(
        address indexed _senderAddress,
        address indexed _receiverAddress,
        uint _balance,
        uint _receiverTokens);

    event ChannelChallenged(
        address indexed _senderAddress,
        address indexed _receiverAddress,
        uint _balance);


    function Channel(address _receiver, address _tokenAddress, uint _challengePeriod) 
    public 
    nonZeroAddress(_receiver) nonZero(_challengePeriod)
    {
        require(_tokenAddress != 0x0);
        require(addressHasCode(_tokenAddress));
        token = Token(_tokenAddress);
        require(token.totalSupply() > 0);

        challengePeriod = _challengePeriod;
        sender = msg.sender;
        receiver = _receiver;
        startDate = now;
        status = State.Initiated;
    }

    function recharge(uint _deposit) 
    external 
    onlySender nonZero(_deposit) 
    {
        require(token.allowance(msg.sender, address(this)) >= _deposit);
        require(token.transferFrom(msg.sender, address(this), _deposit));
        depositedBalance = _deposit;
        status = State.Recharged;

        ChannelRecharged(msg.sender, receiver, depositedBalance);
    }

    function withdraw(uint _balance, bytes _signedBalanceMsg)
    external
    onlyReceiver nonZero(_balance)
    {
        require(status == State.Recharged);
        require(_balance >= depositedBalance.sub(withdrawnBalance));
                
        // Derive sender address from signed balance proof
        address senderAddress = extractBalanceProofSignature(
            msg.sender,
            _balance,
            _signedBalanceMsg
        );
        // Update total withdrawn balance
        withdrawnBalance = withdrawnBalance.add(_balance);

        // Send the remaining balance to the receiver
        require(token.transfer(msg.sender, _balance));

        ChannelWithdraw(senderAddress, msg.sender, _balance);
    }
    
    function mutualSettlement(uint _balance, bytes _signedBalanceMsg, bytes _signedClosingMsg)
    external
    nonZero(_balance)
    {
        require(msg.sender == sender || msg.sender == receiver);
        require(_balance <= depositedBalance);
        
        // Derive sender address from signed balance proof
        address senderAddr = extractBalanceProofSignature(
            receiver,
            _balance,
            _signedBalanceMsg
        );

        // Derive receiver address from closing signature
        address receiverAddr = extractClosingSignature(
            senderAddr,
            _balance,
            _signedClosingMsg
        );
        require(receiverAddr == receiver);

        // Both signatures have been verified and the channel can be settled.
        settleChannel(sender, receiver, _balance);
    }

    function challengedSettlement(uint _balance)
    external
    onlySender nonZero(_balance)
    {
        require(status == State.Recharged);
        require(_balance <= depositedBalance);

        challengeStartTime = now;
        status = State.InChallenge;
        balanceInChallenge = _balance;
        ChannelChallenged(msg.sender, receiver, _balance);
    }
    
    function settle() 
    external 
    onlySender
    {
        require(status == State.InChallenge); 
        require(now > challengeStartTime + challengePeriod * 1 seconds);  

        settleChannel(msg.sender, receiver, balanceInChallenge);
    }    
    
    function extractBalanceProofSignature(address _receiverAddress, uint256 _balance, bytes _signedBalanceMsg)
    internal view
    returns (address)
    {
        bytes32 msgHash = keccak256(
            keccak256(
                "string msgId",
                "address receiver",
                "uint balance",
                "address contract"
            ),
            keccak256(
                "Sender Balance Proof Sign",
                _receiverAddress,
                _balance,   
                address(this)
            )
        );

        // Derive address from signature
        address signer = ECVerification.ecverify(msgHash, _signedBalanceMsg);
        return signer;
    }

    function extractClosingSignature(address _senderAddress, uint _balance, bytes _signedClosingMsg)
    internal view
    returns (address)
    {
        bytes32 msgHash = keccak256(
            keccak256(
                "string msgId",
                "address sender",
                "uint balance",
                "address contract"
            ),
            keccak256(
                "Receiver Closing Sign",
                _senderAddress,
                _balance,
                address(this)
            )
        );

        // Derive address from signature
        address signer = ECVerification.ecverify(msgHash, _signedClosingMsg);
        return signer;
    } 

    function settleChannel(address _senderAddress, address _receiverAddress, uint _balance)
    internal 
    {
        // Send the unwithdrawn _balance to the receiver
        uint receiverRemainingTokens = _balance.sub(withdrawnBalance);
        status = State.Settled;
        require(token.transfer(_receiverAddress, receiverRemainingTokens));

        // Send remaining tokens back to sender
        require(token.transfer(_senderAddress, depositedBalance.sub(receiverRemainingTokens)));

        ChannelSettled(_senderAddress, _receiverAddress, _balance, receiverRemainingTokens);
    }
   
    
    function addressHasCode(address _contract) internal view returns (bool) {
        uint size;
        assembly {
            size := extcodesize(_contract)
        }
        return size > 0;
    }


}