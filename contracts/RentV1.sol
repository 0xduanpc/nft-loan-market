// SPDX-License-Identifier: MIT

pragma solidity =0.8.4;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./rent/RentDomainV1.sol";
import "./rent/RentStateV1.sol";
import "./utils/Uint.sol";
import "./proxy/ERC20TransferProxy.sol";
import "./tokens/RentNFT.sol";

contract RentV1 is Ownable, ReentrancyGuard, RentDomainV1 {
    using SafeMath for uint;
    using UintLibrary for uint;

    event Rent(
        address indexed nft,
        uint indexed nftId,
        address rentIn,
        address rentOut,
        address token,
        uint tokenAmount,
        TokenType tokenType,
        uint startTime,
        uint endTime,
        uint salt
    );

    event Cancel(
        address indexed nft,
        uint256 indexed nftId,
        address owner,
        address token,
        uint tokenAmount,
        TokenType tokenType,
        OrderType orderType,
        uint startTime,
        uint endTime,
        uint256 salt
    );

    bytes32 internal immutable DOMAIN_SEPARATOR;

    bytes32 internal constant ORDER_TYPEHASH =
        keccak256(
            abi.encodePacked(
                "Order(address owner,uint256 salt,address nft,uint256 nftId,",
                "address token,uint256 tokenAmount,uint8 tokenType,uint8 orderType,",
                "uint256 startTime,uint256 endTime)"
            )
        );
    bytes32 internal constant FEE_TYPEHASH =
        keccak256(
            abi.encodePacked(
                "Fee(address owner,uint256 salt,address nft,uint256 nftId,",
                "address token,uint256 tokenAmount,uint8 tokenType,uint8 orderType,",
                "uint256 startTime,uint256 endTime,uint256 rentInFee,uint256 rentOutFee)"
            )
        );

    address payable public beneficiary;
    address public feeSigner;

    ERC20TransferProxy public erc20TransferProxy;
    RentNFT public rentNFT;
    RentStateV1 public state;

    constructor(
        ERC20TransferProxy _erc20TransferProxy,
        RentNFT _rentNFT,
        RentStateV1 _state,
        address payable _beneficiary,
        address _feeSigner
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
        erc20TransferProxy = _erc20TransferProxy;
        rentNFT = _rentNFT;
        state = _state;
        beneficiary = _beneficiary;
        feeSigner = _feeSigner;
    }

    function setBeneficiary(address payable newBeneficiary) external onlyOwner {
        beneficiary = newBeneficiary;
    }

    function setFeeSigner(address newFeeSigner) external onlyOwner {
        feeSigner = newFeeSigner;
    }

    function rent(
        Order calldata order,
        Sig calldata sig,
        uint rentInFee,
        uint rentOutFee,
        Sig calldata feeSig
    ) external payable {
        validateOrderSig(order, sig);
        validateFeeSig(order, rentInFee, rentOutFee, feeSig);
        verifyAndModifyOrderState(order);
        // ETH cannot get approved
        require(
            order.orderType == OrderType.RentOut ||
                order.tokenType != TokenType.ETH,
            "ETH is not supported on rent in side"
        );
        uint amount = order.tokenAmount;
        address token = order.token;
        uint leftAmount;
        if (
            order.orderType == OrderType.RentOut &&
            order.tokenType == TokenType.ETH
        ) {
            leftAmount = validateEthTransfer(amount, rentInFee, rentOutFee);
            mintNFT(
                msg.sender,
                order.nft,
                order.nftId,
                order.startTime,
                order.endTime
            );
        } else if (order.orderType == OrderType.RentIn) {
            leftAmount = erc20Transfer(
                order.owner,
                amount,
                rentInFee,
                rentOutFee,
                token
            );
            mintNFT(
                order.owner,
                order.nft,
                order.nftId,
                order.startTime,
                order.endTime
            );
        } else if (order.orderType == OrderType.RentOut) {
            leftAmount = erc20Transfer(
                msg.sender,
                amount,
                rentInFee,
                rentOutFee,
                token
            );
            mintNFT(
                msg.sender,
                order.nft,
                order.nftId,
                order.startTime,
                order.endTime
            );
        }
        pendingToClaim(order, leftAmount);
        emitRent(order);
    }

    function validateOrderSig(
        Order calldata order,
        Sig calldata sig
    ) internal view {
        require(
            ecrecover(prepareMessage(order), sig.v, sig.r, sig.s) ==
                order.owner,
            "incorrect signature"
        );
    }

    function prepareMessage(
        Order calldata order
    ) public view returns (bytes32) {
        bytes32 orderHash = keccak256(
            abi.encodePacked(ORDER_TYPEHASH, orderEncode(order))
        );
        return
            keccak256(
                abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, orderHash)
            );
    }

    function validateFeeSig(
        Order calldata order,
        uint rentInFee,
        uint rentOutFee,
        Sig calldata sig
    ) internal view {
        require(
            ecrecover(
                prepareFeeMessage(order, rentInFee, rentOutFee),
                sig.v,
                sig.r,
                sig.s
            ) == feeSigner,
            "incorrect fee signature"
        );
    }
    function prepareFeeMessage(
        Order calldata order,
        uint rentInfee,
        uint rentOutfee
    ) public view returns (bytes32) {
        bytes32 feeHash = keccak256(
            abi.encodePacked(
                FEE_TYPEHASH,
                orderEncode(order),
                rentInfee,
                rentOutfee
            )
        );
        return
            keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, feeHash));
    }

    function orderEncode(
        Order calldata order
    ) public pure returns (bytes memory) {
        return
            abi.encode(
                order.owner,
                order.salt,
                order.nft,
                order.nftId,
                order.token,
                order.tokenAmount,
                order.tokenType,
                order.orderType,
                order.startTime,
                order.endTime
            );
    }

    function verifyAndModifyOrderState(Order calldata order) internal {
        require(
            order.orderType != OrderType.RentIn ||
                IERC721(order.nft).ownerOf(order.nftId) == msg.sender,
            string(
                abi.encodePacked(
                    Strings.toHexString(msg.sender),
                    " is not the owner"
                )
            )
        );
        require(
            order.orderType != OrderType.RentOut ||
                IERC721(order.nft).ownerOf(order.nftId) == order.owner,
            string(
                abi.encodePacked(
                    Strings.toHexString(order.owner),
                    " is not the owner"
                )
            )
        );
        require(
            order.startTime < order.endTime,
            "start time should be less than end time"
        );
        require(block.timestamp <= order.startTime, "order is already started");
        bytes32 orderKey = getOrderKey(order);
        bytes32 nftKey = getNftKey(order.nft, order.nftId);
        require(
            !state.getCompleted(orderKey),
            "order is completed or cancelled"
        );
        state.setCompleted(orderKey, true);
        Period[] memory periods = state.getPeriods(nftKey);
        for (uint i = 0; i < periods.length; i++) {
            require(
                (periods[i].endTime <= order.startTime ||
                    periods[i].startTime >= order.endTime),
                string(
                    abi.encodePacked(
                        "nft is already rented between ",
                        Strings.toString(periods[i].startTime),
                        " and ",
                        Strings.toString(periods[i].endTime)
                    )
                )
            );
        }
        state.pushPeriod(nftKey, Period(order.startTime, order.endTime));
    }

    function getOrderKey(Order calldata order) public pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    order.owner,
                    order.salt,
                    order.nft,
                    order.nftId,
                    order.token,
                    order.tokenAmount,
                    order.tokenType,
                    order.orderType,
                    order.startTime,
                    order.endTime
                )
            );
    }

    function getNftKey(address nft, uint nftId) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(nft, nftId));
    }

    function validateEthTransfer(
        uint amount,
        uint rentInFee,
        uint rentOutFee
    ) internal returns (uint) {
        uint256 rentInFeeAmount = amount.bp(rentInFee);
        require(
            msg.value == amount + rentInFeeAmount,
            "msg.value is incorrect"
        );
        uint256 rentOutFeeAmount = amount.bp(rentOutFee);
        if (rentInFeeAmount + rentOutFeeAmount > 0) {
            payable(beneficiary).transfer(rentInFeeAmount + rentOutFeeAmount);
        }
        return amount - rentOutFeeAmount;
    }

    function erc20Transfer(
        address from,
        uint amount,
        uint rentInFee,
        uint rentOutFee,
        address token
    ) internal returns (uint) {
        uint256 rentInFeeAmount = amount.bp(rentInFee);
        uint256 rentOutFeeAmount = amount.bp(rentOutFee);
        erc20TransferProxy.erc20safeTransferFrom(
            IERC20(token),
            from,
            address(this),
            amount - rentOutFeeAmount
        );
        if (rentInFeeAmount + rentOutFeeAmount > 0) {
            erc20TransferProxy.erc20safeTransferFrom(
                IERC20(token),
                from,
                beneficiary,
                rentInFeeAmount + rentOutFeeAmount
            );
        }
        return amount - rentOutFeeAmount;
    }

    function mintNFT(
        address to,
        address nft,
        uint nftId,
        uint startTime,
        uint endTime
    ) internal {
        rentNFT.mint(to, nft, nftId, startTime, endTime);
    }

    function getPeriods(
        address nft,
        uint nftId
    ) external view returns (Period[] memory) {
        return state.getPeriods(getNftKey(nft, nftId));
    }

    function getPendingKey(
        address nft,
        uint nftId,
        uint startTime,
        uint endTime
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(nft, nftId, startTime, endTime));
    }

    function pendingToClaim(Order calldata order, uint leftAmount) internal {
        bytes32 pendingKey = getPendingKey(
            order.nft,
            order.nftId,
            order.startTime,
            order.endTime
        );
        state.setTokenToClaim(
            pendingKey,
            Pending({
                lastClaimTime: order.startTime,
                token: order.token,
                tokenType: order.tokenType,
                tokenAmount: leftAmount
            })
        );
    }

    function claim(
        address nft,
        uint nftId,
        uint startTime,
        uint endTime
    ) external nonReentrant {
        require(
            IERC721(nft).ownerOf(nftId) == msg.sender,
            "not an owner of the NFT"
        );

        bytes32 pendingKey = getPendingKey(nft, nftId, startTime, endTime);
        Pending memory pend = state.getTokenToClaim(pendingKey);
        uint claimAmount;
        if (block.timestamp >= endTime) {
            claimAmount = pend.tokenAmount;
            bytes32 nftKey = getNftKey(nft, nftId);
            state.popPeriod(nftKey, Period(startTime, endTime));
        } else if (block.timestamp > pend.lastClaimTime) {
            claimAmount = (
                pend.tokenAmount.mul(block.timestamp - pend.lastClaimTime)
            ).div(endTime - pend.lastClaimTime);
            pend.tokenAmount -= claimAmount;
            pend.lastClaimTime = block.timestamp;
            state.setTokenToClaim(pendingKey, pend);
        }
        if (claimAmount > 0) {
            if (pend.tokenType == TokenType.ETH) {
                payable(msg.sender).transfer(claimAmount);
            } else {
                IERC20(pend.token).transfer(msg.sender, claimAmount);
            }
        }
    }

    function getPending(
        address nft,
        uint nftId,
        uint startTime,
        uint endTime
    ) external view returns (Pending memory) {
        bytes32 pendingKey = getPendingKey(nft, nftId, startTime, endTime);
        return state.getTokenToClaim(pendingKey);
    }

    function cancel(Order calldata order) external {
        require(order.owner == msg.sender, "not an owner");
        bytes32 orderKey = getOrderKey(order);
        require(
            state.getCompleted(orderKey) == false,
            "already started or cancelled"
        );
        state.setCompleted(orderKey, true);
        emit Cancel(
            order.nft,
            order.nftId,
            order.owner,
            order.token,
            order.tokenAmount,
            order.tokenType,
            order.orderType,
            order.startTime,
            order.endTime,
            order.salt
        );
    }

    function emitRent(Order calldata order) internal {
        emit Rent(
            order.nft,
            order.nftId,
            order.orderType == OrderType.RentIn ? order.owner : msg.sender,
            order.orderType == OrderType.RentOut ? order.owner : msg.sender,
            order.token,
            order.tokenAmount,
            order.tokenType,
            order.startTime,
            order.endTime,
            order.salt
        );
    }
}
