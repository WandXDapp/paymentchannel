pragma solidity ^0.4.18;

contract Channel {
    address wandAddress;
    uint public challengePeriod;
    uint deposit;
    address public sender;
    address public receiver;
    uint public startDate;

    WandToken public token;

    modifier onlySender() {
        require(msg.sender == sender);
        _;
    }

    modifier onlyReceiver() {
        require(msg.sender == receiver);
        _;
    }

    event ChannelCreated(
        address indexed _sender_address,
        address indexed _receiver_address,
        uint192 _deposit);


    function Channel(address _receiver, uint _challengePeriod) {
        challengePeriod = _challengePeriod * 1 seconds;
        sender = msg.sender;
        receiver = _receiver;
        startDate = now;

        token = WandToken(wandAddress);
    }

    function initiateChannel (uint _deposit) onlySender {
        require(token.allowance[msg.sender][address(this)] >= _deposit);
        require(token.transferFrom(msg.sender, address(this), _deposit));
        deposit = _deposit; 
    }


}