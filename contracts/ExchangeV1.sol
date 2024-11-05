// SPDX-License-Identifier: MIT

pragma solidity =0.8.4;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import "hardhat/console.sol";
import "./exchange/ExchangeDomainV1.sol";
import "./exchange/ExchangeStateV1.sol";
import "./utils/Uint.sol";
import "./proxy/ERC20TransferProxy.sol";
import "./proxy/TransferProxy.sol";

contract ExchangeV1 is Ownable, ExchangeDomainV1 {
    using SafeMath for uint;
    using UintLibrary for uint;
    using ECDSA for bytes32;
    using ECDSA for bytes;

    enum FeeSide {
        NONE,
        SELL,
        BUY
    }

    event Buy(
        address indexed sellToken,
        uint256 indexed sellTokenId,
        uint256 sellValue,
        address owner,
        address buyToken,
        uint256 buyTokenId,
        uint256 buyValue,
        address buyer,
        uint256 amount,
        uint256 salt
    );

    event Cancel(
        address indexed sellToken,
        uint256 indexed sellTokenId,
        address owner,
        address buyToken,
        uint256 buyTokenId,
        uint256 salt
    );

    uint256 private constant UINT256_MAX = 2 ** 256 - 1;

    bytes32 internal immutable DOMAIN_SEPARATOR;
    bytes32 internal constant ORDER_TYPEHASH =
        keccak256(
            abi.encodePacked(
                "Order(address owner,uint256 salt,address sellToken,uint256 sellTokenId,",
                "uint8 sellAssetType,address buyToken,uint256 buyTokenId,uint8 buyAssetType,",
                "uint256 selling,uint256 buying,uint256 sellerFee)"
            )
        );
    bytes32 internal constant BUYERFEE_TYPEHASH =
        keccak256(
            abi.encodePacked(
                "BuyerFee(address owner,uint256 salt,address sellToken,uint256 sellTokenId,",
                "uint8 sellAssetType,address buyToken,uint256 buyTokenId,uint8 buyAssetType,",
                "uint256 selling,uint256 buying,uint256 sellerFee,uint256 buyerFee)"
            )
        );

    address payable public beneficiary;
    address public buyerFeeSigner;

    TransferProxy public transferProxy;
    ERC20TransferProxy public erc20TransferProxy;
    ExchangeStateV1 public state;

    constructor(
        TransferProxy _transferProxy,
        ERC20TransferProxy _erc20TransferProxy,
        ExchangeStateV1 _state,
        address payable _beneficiary,
        address _buyerFeeSigner
    ) {
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes("NFT-MARKET")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
        transferProxy = _transferProxy;
        erc20TransferProxy = _erc20TransferProxy;
        state = _state;
        beneficiary = _beneficiary;
        buyerFeeSigner = _buyerFeeSigner;
    }

    function setBeneficiary(address payable newBeneficiary) external onlyOwner {
        beneficiary = newBeneficiary;
    }

    function setBuyerFeeSigner(address newBuyerFeeSigner) external onlyOwner {
        buyerFeeSigner = newBuyerFeeSigner;
    }

    function exchange(
        Order calldata order,
        Sig calldata sig,
        uint buyerFee,
        Sig calldata buyerFeeSig,
        uint amount,
        address buyer
    ) external payable {
        validateOrderSig(order, sig);
        validateBuyerFeeSig(order, buyerFee, buyerFeeSig);
        uint paying = order.buying.mul(amount).div(order.selling);
        verifyOpenAndModifyOrderState(order.key, order.selling, amount);
        // ETH cannot get approved
        require(
            order.key.sellAsset.assetType != AssetType.ETH,
            "ETH is not supported on sell side"
        );
        if (order.key.buyAsset.assetType == AssetType.ETH) {
            validateEthTransfer(paying, buyerFee);
        }
        FeeSide feeSide = getFeeSide(
            order.key.sellAsset.assetType,
            order.key.buyAsset.assetType
        );
        if (buyer == address(0x0)) {
            buyer = msg.sender;
        }
        transferWithFeesPossibility(
            order.key.sellAsset,
            amount,
            order.key.owner,
            buyer,
            feeSide == FeeSide.SELL,
            buyerFee,
            order.sellerFee
        );
        transferWithFeesPossibility(
            order.key.buyAsset,
            paying,
            msg.sender,
            order.key.owner,
            feeSide == FeeSide.BUY,
            order.sellerFee,
            buyerFee
        );
        emitBuy(order, amount, buyer);
    }

    function validateEthTransfer(uint value, uint buyerFee) internal view {
        uint256 buyerFeeValue = value.bp(buyerFee);
        require(msg.value == value + buyerFeeValue, "msg.value is incorrect");
    }

    function cancel(OrderKey calldata key) external {
        require(key.owner == msg.sender, "not an owner");
        state.setCompleted(key, UINT256_MAX);
        emit Cancel(
            key.sellAsset.token,
            key.sellAsset.tokenId,
            msg.sender,
            key.buyAsset.token,
            key.buyAsset.tokenId,
            key.salt
        );
    }

    function validateOrderSig(
        Order calldata order,
        Sig calldata sig
    ) internal view {
        require(
            ecrecover(prepareMessage(order), sig.v, sig.r, sig.s) ==
                order.key.owner,
            "incorrect signature"
        );
    }

    function validateBuyerFeeSig(
        Order memory order,
        uint buyerFee,
        Sig calldata sig
    ) internal view {
        require(
            ecrecover(
                prepareBuyerFeeMessage(order, buyerFee),
                sig.v,
                sig.r,
                sig.s
            ) == buyerFeeSigner,
            "incorrect buyer fee signature"
        );
    }

    function orderEncode(
        Order memory order
    ) public pure returns (bytes memory) {
        return
            abi.encode(
                order.key.owner,
                order.key.salt,
                order.key.sellAsset.token,
                order.key.sellAsset.tokenId,
                order.key.sellAsset.assetType,
                order.key.buyAsset.token,
                order.key.buyAsset.tokenId,
                order.key.buyAsset.assetType,
                order.selling,
                order.buying,
                order.sellerFee
            );
    }

    function prepareBuyerFeeMessage(
        Order memory order,
        uint fee
    ) public view returns (bytes32) {
        bytes32 buyerFeeHash = keccak256(
            abi.encodePacked(BUYERFEE_TYPEHASH, orderEncode(order), fee)
        );
        return
            keccak256(
                abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, buyerFeeHash)
            );
    }

    function prepareMessage(Order memory order) public view returns (bytes32) {
        bytes32 orderHash = keccak256(
            abi.encodePacked(ORDER_TYPEHASH, orderEncode(order))
        );
        return
            keccak256(
                abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, orderHash)
            );
    }

    function transferWithFeesPossibility(
        Asset memory firstType,
        uint value,
        address from,
        address to,
        bool hasFee,
        uint256 sellerFee,
        uint256 buyerFee
    ) internal {
        if (!hasFee) {
            transfer(firstType, value, from, to);
        } else {
            transferWithFees(firstType, value, from, to, sellerFee, buyerFee);
        }
    }

    function transfer(
        Asset memory asset,
        uint value,
        address from,
        address to
    ) internal {
        if (asset.assetType == AssetType.ETH) {
            payable(to).transfer(value);
        } else if (asset.assetType == AssetType.ERC20) {
            require(asset.tokenId == 0, "tokenId should be 0");
            erc20TransferProxy.erc20safeTransferFrom(
                IERC20(asset.token),
                from,
                to,
                value
            );
        } else if (asset.assetType == AssetType.ERC721) {
            require(value == 1, "value should be 1 for ERC-721");
            transferProxy.erc721safeTransferFrom(
                IERC721(asset.token),
                from,
                to,
                asset.tokenId
            );
        } else {
            transferProxy.erc1155safeTransferFrom(
                IERC1155(asset.token),
                from,
                to,
                asset.tokenId,
                value,
                ""
            );
        }
    }

    function transferWithFees(
        Asset memory firstType,
        uint value,
        address from,
        address to,
        uint256 sellerFee,
        uint256 buyerFee
    ) internal {
        uint restValue = transferFeeToBeneficiary(
            firstType,
            from,
            value,
            sellerFee,
            buyerFee
        );
        transfer(firstType, restValue, from, to);
    }

    function transferFeeToBeneficiary(
        Asset memory asset,
        address from,
        uint total,
        uint sellerFee,
        uint buyerFee
    ) internal returns (uint) {
        (uint restValue, uint sellerFeeValue) = subFeeInBp(
            total,
            total,
            sellerFee
        );
        uint buyerFeeValue = total.bp(buyerFee);
        uint beneficiaryFee = buyerFeeValue.add(sellerFeeValue);
        if (beneficiaryFee > 0) {
            transfer(asset, beneficiaryFee, from, beneficiary);
        }
        return restValue;
    }

    function emitBuy(Order memory order, uint amount, address buyer) internal {
        emit Buy(
            order.key.sellAsset.token,
            order.key.sellAsset.tokenId,
            order.selling,
            order.key.owner,
            order.key.buyAsset.token,
            order.key.buyAsset.tokenId,
            order.buying,
            buyer,
            amount,
            order.key.salt
        );
    }

    function subFeeInBp(
        uint value,
        uint total,
        uint feeInBp
    ) internal pure returns (uint newValue, uint realFee) {
        return subFee(value, total.bp(feeInBp));
    }

    function subFee(
        uint value,
        uint fee
    ) internal pure returns (uint newValue, uint realFee) {
        if (value > fee) {
            newValue = value - fee;
            realFee = fee;
        } else {
            newValue = 0;
            realFee = value;
        }
    }

    function verifyOpenAndModifyOrderState(
        OrderKey memory key,
        uint selling,
        uint amount
    ) internal {
        uint completed = state.getCompleted(key);
        uint newCompleted = completed.add(amount);
        require(
            newCompleted <= selling,
            "not enough stock of order for buying"
        );
        state.setCompleted(key, newCompleted);
    }

    function getFeeSide(
        AssetType sellType,
        AssetType buyType
    ) internal pure returns (FeeSide) {
        if (sellType == AssetType.ERC721 && buyType == AssetType.ERC721) {
            return FeeSide.NONE;
        }
        if (uint(sellType) > uint(buyType)) {
            return FeeSide.BUY;
        }
        return FeeSide.SELL;
    }
}
