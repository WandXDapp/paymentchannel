pragma solidity ^0.4.18;

import './token/token.sol';

contract Channel {
    uint public challengePeriod;
    uint deposit;
    address public sender;
    address public receiver;
    uint public startDate;

    Token public token;

    modifier onlySender() {
        require(msg.sender == sender);
        _;
    }

    modifier onlyReceiver() {
        require(msg.sender == receiver);
        _;
    }

    event ChannelRecharged(
        address indexed _senderAddress,
        address indexed _receiverAddress,
        uint _deposit);


    function Channel(address _receiver, address _tokenAddress, uint _challengePeriod) {
        require(_tokenAddress != 0x0);
        require(addressHasCode(_tokenAddress));

        token = Token(_tokenAddress);
        require(token.totalSupply() > 0);

        challengePeriod = _challengePeriod;
        sender = msg.sender;
        receiver = _receiver;
        startDate = now;
    }

    function rechargeChannel (uint _deposit) onlySender {
        require(token.allowance(msg.sender, address(this)) >= _deposit);
        require(token.transferFrom(msg.sender, address(this), _deposit));
        deposit = _deposit; 

        ChannelRecharged(msg.sender, receiver, deposit);
    }

    function addressHasCode(address _contract) internal view returns (bool) {
        uint size;
        assembly {
            size := extcodesize(_contract)
        }
        return size > 0;
    }


}