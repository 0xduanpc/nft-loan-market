// SPDX-License-Identifier: MIT

pragma solidity =0.8.4;

contract RentDomainV1 {
    enum TokenType {
        ETH,
        ERC20
    }

    enum OrderType {
        RentIn,
        RentOut
    }

    struct Order {
        address owner;
        uint salt;
        address nft;
        uint nftId;
        address token;
        uint tokenAmount;
        TokenType tokenType;
        OrderType orderType;
        uint startTime;
        uint endTime;
    }

    /* An ECDSA signature. */
    struct Sig {
        /* v parameter */
        uint8 v;
        /* r parameter */
        bytes32 r;
        /* s parameter */
        bytes32 s;
    }
}
