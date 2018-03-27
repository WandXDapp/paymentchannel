pragma solidity ^0.4.18;

/**
 * @title SafeMath
 * @dev Math operations with safety checks that throw on error
 */
library SafeMath {

  // mul and div are not being used
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
        depositedBalance = _deposit;
        status = State.Recharged;
        return true;
    }

    /**
     * @dev `withdraw` to withdraw tokens from channel once or multiple times
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
        require(_balance <= depositedBalance.sub(withdrawnBalance));                
        require(extractBalanceProofSignature(receiver, _balance, _vbal, _rbal, _sbal));
        // Update total withdrawn balance
        withdrawnBalance = withdrawnBalance.add(_balance);
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
        require(status == State.Recharged || status == State.InChallenge);
        require(_balance <= depositedBalance.sub(withdrawnBalance));
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
    struct User{
        address sender;
        address receiver;
    }
    address public owner;
    mapping(address => address[]) channelsAsSender;
    mapping(address => address[]) channelsAsReceiver;
    mapping(address => User) channelUsers;

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

    modifier isSender(address _channelAddr, address _senderAddr) {
        require(channelUsers[_channelAddr].sender == _senderAddr);
        _;
    }

    modifier isReceiver(address _channelAddr, address _receiverAddr) {
        require(channelUsers[_channelAddr].receiver == _receiverAddr);
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
        channelUsers[channel] = User(sender, _receiver);
        ChannelCreated(sender, _receiver, channel);
    }
    
    /**
     * @dev `rechargeChannel` to recharge a new channel
     * @param _channelAddress address of channel
     * @param _deposit number of tokens to deposit
     */
    function rechargeChannel(address _channelAddress, uint _deposit) 
    external
    isContractAddress(_channelAddress) nonZero(_deposit) isSender(_channelAddress, msg.sender)
    {
        channel = Channel(_channelAddress);
        require(channel.recharge(_deposit));

        ChannelRecharged(msg.sender, _deposit);
    }

    /**
     * @dev `withdrawFromChannel` to withdraw a new channel
     * @param _channelAddress address of channel
     * @param _balance number of tokens to withdraw
     * @param _v v of signedBalanceHash
     * @param _r r of signedBalanceHash
     * @param _s s of signedBalanceHash
     */
    function withdrawFromChannel(address _channelAddress, uint _balance, uint8 _v, bytes32 _r, bytes32 _s) 
    external
    isContractAddress(_channelAddress) nonZero(_balance) isReceiver(_channelAddress, msg.sender)
    {
        channel = Channel(_channelAddress);
        require(channel.withdraw(_balance, _v, _r, _s));

        ChannelWithdraw(msg.sender, _balance);
    }

    /**
     * @dev `channelMutualSettlement` to settle channel with mutual consent of sender & receiver
     * @param _channelAddress address of channel
     * @param _balance number of tokens to withdraw
     * @param _vbal v of signedBalanceHash
     * @param _rbal r of signedBalanceHash
     * @param _sbal s of signedBalanceHash
     * @param _vclose v of signedClosingHash
     * @param _rclose r of signedClosingHash
     * @param _sclose s of signedClosingHash
     */
    function channelMutualSettlement(address _channelAddress, uint _balance, uint8 _vbal, bytes32 _rbal, bytes32 _sbal, uint8 _vclose, bytes32 _rclose, bytes32 _sclose) 
    external
    isContractAddress(_channelAddress) nonZero(_balance) 
    {
        require(channelUsers[_channelAddress].sender == msg.sender || channelUsers[_channelAddress].receiver == msg.sender);
        channel = Channel(_channelAddress);
        require(channel.mutualSettlement(_balance, _vbal, _rbal, _sbal, _vclose, _rclose, _sclose));

        ChannelSettled(msg.sender, _balance);
    }

    /**
     * @dev `channelChallengedSettlement` to challenge a channel by sender in case of malicious receiver
     * @param _channelAddress address of channel
     * @param _balance total number of tokens to allocated to receiver
     */
    function channelChallengedSettlement(address _channelAddress, uint _balance) 
    external
    isContractAddress(_channelAddress) nonZero(_balance) isSender(_channelAddress, msg.sender)
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
    isContractAddress(_channelAddress) isSender(_channelAddress, msg.sender)
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
     * @dev `getChannelUsers` to get sender and receiver of channel
     * @return struct User
     */
    function getChannelUsers (address channelAddress) external view returns (address, address) {
        return (channelUsers[channelAddress].sender, channelUsers[channelAddress].receiver);
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