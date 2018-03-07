pragma solidity ^0.4.18;

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