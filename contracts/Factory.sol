pragma solidity ^0.4.18;

import "./Channel.sol";
import "./lib/safeMath.sol";

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