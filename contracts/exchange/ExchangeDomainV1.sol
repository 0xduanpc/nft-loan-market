// SPDX-License-Identifier: MIT

pragma solidity =0.8.4;

contract ExchangeDomainV1 {
    enum AssetType {
        ETH,
        ERC20,
        ERC1155,
        ERC721
    }

    struct Asset {
        address token;
        uint tokenId;
        AssetType assetType;
    }

    struct OrderKey {
        /* who signed the order */
        address owner;
        /* random number */
        uint salt;
        /* what has owner */
        Asset sellAsset;
        /* what wants owner */
        Asset buyAsset;
    }

    struct Order {
        OrderKey key;
        uint selling;
        uint buying;
        /* fee for selling */
        uint sellerFee;
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
