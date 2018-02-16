pragma solidity ^0.4.18;

import './Channel.sol';
import './lib/safeMath.sol';

contract Factory {
    address public owner;
    mapping(address => address[]) channelsAsSender;
    mapping(address => address[]) channelsAsReceiver;

    Channel public channel;

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

    function Factory() public {
        owner = msg.sender;
    }


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

    function rechargeChannel(address _channelAddress, uint _deposit) 
    external
    isContractAddress(_channelAddress) nonZero(_deposit) 
    {
        channel = Channel(_channelAddress);
        require(channel.recharge(_deposit));

        ChannelRecharged(msg.sender, _deposit);
    }

    function withdrawFromChannel(address _channelAddress, uint _balance, bytes _balanceMsg) 
    external
    isContractAddress(_channelAddress) nonZero(_balance) 
    {
        channel = Channel(_channelAddress);
        require(channel.withdraw(_balance, _balanceMsg));

        ChannelWithdraw(msg.sender, _balance);
    }

    function channelMutualSettlement(address _channelAddress, uint _balance, bytes _balanceMsg, bytes _closingMsg) 
    external
    isContractAddress(_channelAddress) nonZero(_balance) 
    {
        channel = Channel(_channelAddress);
        require(channel.mutualSettlement(_balance, _balanceMsg, _closingMsg));

        ChannelSettled(msg.sender, _balance);
    }

    function channelChallengedSettlement(address _channelAddress, uint _balance) 
    external
    isContractAddress(_channelAddress) nonZero(_balance) 
    {
        channel = Channel(_channelAddress);
        require(channel.challengedSettlement(_balance));

        ChannelChallenged(msg.sender, _balance);
    }

    function channelAfterChallengeSettlement(address _channelAddress) 
    external
    isContractAddress(_channelAddress)
    {
        channel = Channel(_channelAddress);
        var balance = channel.afterChallengeSettle();

        ChannelSettled(msg.sender, balance);
    }

    function getInfo(address _channelAddress) 
    external view 
    isContractAddress(_channelAddress)
    returns (address, address, address, uint, uint, Channel.State, uint, uint)
    {
        return Channel(_channelAddress).getChannelInfo();
    }

    function getAllChannelsAsSender () external view returns (address[]) {
        return channelsAsSender[msg.sender];
    }

    function getAllChannelsAsReceiver () external view returns (address[]) {
        return channelsAsReceiver[msg.sender];
    }
    
    function addressHasCode(address _contract) internal view returns (bool) {
        uint size;
        assembly {
            size := extcodesize(_contract)
        }
        return size > 0;
    }
}