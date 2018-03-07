pragma solidity ^0.4.18;

/**
 * @title SafeMath
 * @dev Math operations with safety checks that throw on error
 */
library SafeMath {

  // mul and div are not being used
  // function mul(uint256 a, uint256 b) internal pure returns (uint256) {
  //   uint256 c = a * b;
  //   assert(a == 0 || c / a == b);
  //   return c;
  // }

  // function div(uint256 a, uint256 b) internal pure returns (uint256) {
  //   // assert(b > 0); // Solidity automatically throws when dividing by 0
  //   uint256 c = a / b;
  //   // assert(a == b * c + a % b); // There is no case in which this doesn't hold
  //   return c;
  // }

  function sub(uint256 a, uint256 b) internal pure returns (uint256) {
    assert(b <= a);
    return a - b;
  }

  function add(uint256 a, uint256 b) internal pure returns (uint256) {
    uint256 c = a + b;
    assert(c >= a);
    return c;
  }
}

/// @title Base Token contract - Functions to be implemented by token contracts.
contract Token {
   

    /*
     * This is a slight change to the ERC20 base standard.
     * function totalSupply() constant returns (uint256 supply);
     * is replaced with:
     * uint256 public totalSupply;
     * This automatically creates a getter function for the totalSupply.
     * This is moved to the base contract since public getter functions are not
     * currently recognised as an implementation of the matching abstract
     * function by the compiler.
     */
    uint256 public totalSupply;
    string public name;                   
    uint8 public decimals;                
    string public symbol;                 


    /// @param _owner The address from which the balance will be retrieved.
    /// @return The balance.
    function balanceOf(address _owner) public view returns (uint256 balance);

    /// @notice send `_value` token to `_to` from `msg.sender`.
    /// @param _to The address of the recipient.
    /// @param _value The amount of token to be transferred.
    /// @return Whether the transfer was successful or not.
    function transfer(address _to, uint256 _value) public returns (bool success);

    /// @notice send `_value` token to `_to` from `_from` on the condition it is approved by `_from`.
    /// @param _from The address of the sender.
    /// @param _to The address of the recipient.
    /// @param _value The amount of token to be transferred.
    /// @return Whether the transfer was successful or not.
    function transferFrom(address _from, address _to, uint256 _value) public returns (bool success);

    /// @notice `msg.sender` approves `_spender` to spend `_value` tokens.
    /// @param _spender The address of the account able to transfer the tokens.
    /// @param _value The amount of tokens to be approved for transfer.
    /// @return Whether the approval was successful or not.
    function approve(address _spender, uint256 _value) public returns (bool success);

    /// @param _owner The address of the account owning tokens.
    /// @param _spender The address of the account able to transfer the tokens.
    /// @return Amount of remaining tokens allowed to spent.
    function allowance(address _owner, address _spender) public view returns (uint256 remaining);

    /*
     * Events
     */
    event Transfer(address indexed _from, address indexed _to, uint256 _value);
    event Approval(address indexed _owner, address indexed _spender, uint256 _value);

}

contract ECVerification {

    /**
     * @dev `ecverify` to verify the signature
     * @param hash hash prepared by callee contract
     * @param signature signed message
     * @return signatureAddress signer address
     */
    function ecverify(bytes32 hash, bytes signature) public pure returns (address signatureAddress) {
        require(signature.length == 65);

        bytes32 r;
        bytes32 s;
        uint8 v;

        // The signature format is a compact form of:
        //   {bytes32 r}{bytes32 s}{uint8 v}
        // Compact means, uint8 is not padded to 32 bytes.
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := and(mload(add(signature, 65)), 255)
        }

        // Version of signature should be 27 or 28, but 0 and 1 are also possible
        if (v < 27) {
            v += 27;
        }

        require(v == 27 || v == 28);
        /* 
        * https://github.com/ethereum/go-ethereum/issues/3731
        */
        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        hash = keccak256(prefix, hash);
        signatureAddress = ecrecover(hash, v, r, s);

        // ecrecover returns zero on error
        require(signatureAddress != 0x0);

        return signatureAddress;
    }
}

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

contract Factory {

    /*
     *  Data structures
     */

    address public owner;
    mapping(address => address[]) channelsAsSender;
    mapping(address => address[]) channelsAsReceiver;

    Token public token;

    Channel public channel;

    /*
     * modifiers
     */

    modifier nonZero(uint _param) {
        require(_param > 0);
        _;
    }

    modifier nonZeroAddress(address _addr) {
        require(_addr != address(0));
        _;
    }

    modifier isContractAddress(address _addr) {
        require(_addr != address(0) && addressHasCode(_addr));
        _;
    }

    /*
     * events
     */

    event ChannelCreated(
        address indexed _senderAddress,
        address indexed _receiverAddress,
        address _channelAddress);
    
    event ChannelRecharged(
        address indexed _senderAddress,
        uint _deposit);

    event ChannelWithdraw(
        address indexed _receiverAddress,
        uint _withdrawnBalance);

    event ChannelSettled(
        address indexed _settleAddress,
        uint _balance);

    event ChannelChallenged(
        address indexed _senderAddress,
        uint _balance);

    /**
    * @dev `constructor`
    */

    function Factory() public {
        owner = msg.sender;
    }

    /**
     * @dev `createChannel` to create a new channel
     * @param _receiver address of receiver of channel
     * @param _tokenAddress address of token used for payment
     * @param _challengePeriod challenge period in seconds
     */
    function createChannel (address _receiver, address _tokenAddress, uint _challengePeriod) 
    external
    nonZeroAddress(_receiver) isContractAddress(_tokenAddress) nonZero(_challengePeriod)
    {
        address sender = msg.sender;
        channel = new Channel(_receiver,  sender, _tokenAddress, _challengePeriod);
        require(addressHasCode(channel));
        channelsAsSender[sender].push(channel);
        channelsAsReceiver[_receiver].push(channel);

        ChannelCreated(sender, _receiver, channel);
    }
    
    /**
     * @dev `rechargeChannel` to recharge a new channel
     * @param _channelAddress address of channel
     * @param _deposit number of tokens to deposit
     */
    function rechargeChannel(address _channelAddress, uint _deposit) 
    external
    isContractAddress(_channelAddress) nonZero(_deposit) 
    {
        channel = Channel(_channelAddress);
        require(channel.recharge(_deposit));

        ChannelRecharged(msg.sender, _deposit);
    }

    /**
     * @dev `withdrawFromChannel` to withdraw a new channel
     * @param _channelAddress address of channel
     * @param _balance number of tokens to withdraw
     * @param _balanceMsg balance hash signed by sender
     */
    function withdrawFromChannel(address _channelAddress, uint _balance, bytes _balanceMsg) 
    external
    isContractAddress(_channelAddress) nonZero(_balance) 
    {
        channel = Channel(_channelAddress);
        require(channel.withdraw(_balance, _balanceMsg));

        ChannelWithdraw(msg.sender, _balance);
    }

    /**
     * @dev `channelMutualSettlement` to settle channel with mutual consent of sender & receiver
     * @param _channelAddress address of channel
     * @param _balance number of tokens to withdraw
     * @param _balanceMsg balance hash signed by sender
     * @param _closingMsg closing hash signed by receiver
     */
    function channelMutualSettlement(address _channelAddress, uint _balance, bytes _balanceMsg, bytes _closingMsg) 
    external
    isContractAddress(_channelAddress) nonZero(_balance) 
    {
        channel = Channel(_channelAddress);
        require(channel.mutualSettlement(_balance, _balanceMsg, _closingMsg));

        ChannelSettled(msg.sender, _balance);
    }

    /**
     * @dev `channelChallengedSettlement` to challenge a channel by sender in case of malicious receiver
     * @param _channelAddress address of channel
     * @param _balance total number of tokens to allocated to receiver
     */
    function channelChallengedSettlement(address _channelAddress, uint _balance) 
    external
    isContractAddress(_channelAddress) nonZero(_balance) 
    {
        channel = Channel(_channelAddress);
        require(channel.challengedSettlement(_balance));

        ChannelChallenged(msg.sender, _balance);
    }

    /**
     * @dev `channelAfterChallengeSettlement` to settle a channel by sender after completion of challenge period
     * @param _channelAddress address of channel
     */
    function channelAfterChallengeSettlement(address _channelAddress) 
    external
    isContractAddress(_channelAddress)
    {
        channel = Channel(_channelAddress);
        var balance = channel.afterChallengeSettle();

        ChannelSettled(msg.sender, balance);
    }

    /**
     * @dev `getInfo` to get complete information of a channel 
     * @param _channelAddress address of channel
     * @return all parameters of channel
     */
    function getInfo(address _channelAddress) 
    external view 
    isContractAddress(_channelAddress)
    returns (address, address, address, uint, uint, Channel.State, uint, uint)
    {
        return Channel(_channelAddress).getChannelInfo();
    }

    /**
     * @dev `getChallengeDetails` to get details of a challenge only if it is active for the channel
     * @param _channelAddress address of channel
     * @return all parameters of challenge
     */
    function getChallengeDetails(address _channelAddress) 
    external view 
    isContractAddress(_channelAddress)
    returns (uint, uint, uint)
    {
        return Channel(_channelAddress).getChallengeInfo();
    }

    /**
     * @dev `getAllChannelsAsSender` to get all the channels created as sender
     * @return array of channel addresses
     */
    function getAllChannelsAsSender () external view returns (address[]) {
        return channelsAsSender[msg.sender];
    }

    /**
     * @dev `getAllChannelsAsReceiver` to get all the channels created as receiver
     * @return array of channel addresses
     */
    function getAllChannelsAsReceiver () external view returns (address[]) {
        return channelsAsReceiver[msg.sender];
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