pragma solidity ^0.4.18;

import "../raiden_contracts/RaidenMicroTransferChannels.sol";

contract WandPay {

    address constant ESCROW = "0x1234";
    // On one of the test networks
    address constant PAYMENT_CHANNEL_ADDRESS = "0xe71269969cfd3c9c13c31c1caaf1ac4f242075ed";

    // Account from which gas will be used
    address constant GAS_PAYER = "0x3241";
    address public customer;
    address public merchant;
    bytes32 public channel_id;
    uint public amount;

    function WandPay(address to) {
        customer = msg.sender;
        merchant = to;
        amount = msg.value;
    }

    function authorizePayment() payable {
        assert (customer.balance > amount);

    }

    function isValidMerchant(address merchant) {
        // How to validate merchant is on wandx platform 
    }

    event PaymentReceived(address indexed _customer, address indexed _merchant, uint amount);
}