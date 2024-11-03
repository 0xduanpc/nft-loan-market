// SPDX-License-Identifier: MIT

pragma solidity =0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../role/OwnableOperatorRole.sol";

contract ERC20TransferProxy is OwnableOperatorRole {
    function erc20safeTransferFrom(
        IERC20 token,
        address from,
        address to,
        uint256 value
    ) external onlyOperator {
        require(
            token.transferFrom(from, to, value),
            "failure while transferring"
        );
    }
}
