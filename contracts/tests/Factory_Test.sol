pragma solidity ^0.4.21;

import "./Channel_Test.sol";
import "./../lib/SafeMath.sol";

contract Factory_Test {

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

    function Factory_Test() public {
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
    {
        require(_receiver != address(0) && _receiver != msg.sender);
        require(_challengePeriod > 0);
        address sender = msg.sender;
        channel = new Channel(_receiver,  sender, _tokenAddress, _challengePeriod);
        require(addressHasCode(channel));
        channelsAsSender[sender].push(channel);
        channelsAsReceiver[_receiver].push(channel);
        channelUsers[channel] = User(sender, _receiver);
        emit ChannelCreated(sender, _receiver, channel);
    }
    
    /**
     * @dev `rechargeChannel` to recharge a new channel
     * @param _channelAddress address of channel
     * @param _deposit number of tokens to deposit
     */
    function rechargeChannel(address _channelAddress, uint _deposit) 
    external
    isSender(_channelAddress, msg.sender)
    {
        channel = Channel(_channelAddress);
        require(channel.recharge(_deposit));

        emit ChannelRecharged(msg.sender, _deposit);
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
    isReceiver(_channelAddress, msg.sender)
    {
        channel = Channel(_channelAddress);
        require(channel.withdraw(_balance, _v, _r, _s));

        emit ChannelWithdraw(msg.sender, _balance);
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
    {
        require(channelUsers[_channelAddress].sender == msg.sender || channelUsers[_channelAddress].receiver == msg.sender);
        channel = Channel(_channelAddress);
        require(channel.mutualSettlement(_balance, _vbal, _rbal, _sbal, _vclose, _rclose, _sclose));

        emit ChannelSettled(msg.sender, _balance);
    }

    /**
     * @dev `channelChallengedSettlement` to challenge a channel by sender in case of malicious receiver
     * @param _channelAddress address of channel
     * @param _balance total number of tokens to allocated to receiver
     */
    function channelChallengedSettlement(address _channelAddress, uint _balance) 
    external
    isSender(_channelAddress, msg.sender)
    {
        channel = Channel(_channelAddress);
        require(channel.challengedSettlement(_balance));

        emit ChannelChallenged(msg.sender, _balance);
    }

    /**
     * @dev `channelAfterChallengeSettlement` to settle a channel by sender after completion of challenge period
     * @param _channelAddress address of channel
     */
    function channelAfterChallengeSettlement(address _channelAddress) 
    external
    isSender(_channelAddress, msg.sender)
    {
        channel = Channel(_channelAddress);
        uint balance = channel.afterChallengeSettle();

        emit ChannelSettled(msg.sender, balance);
    }

    /**
     * @dev `getInfo` to get complete information of a channel 
     * @param _channelAddress address of channel
     * @return all parameters of channel
     */
    function getInfo(address _channelAddress) 
    external view 
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