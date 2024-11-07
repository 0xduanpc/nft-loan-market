// SPDX-License-Identifier: MIT

pragma solidity =0.8.4;
pragma experimental ABIEncoderV2;

import "../role/OwnableOperatorRole.sol";
import "./RentDomainV1.sol";

contract RentStateV1 is OwnableOperatorRole {
    // rent started or cancelled
    mapping(bytes32 => bool) public completed;
    // nft + id
    mapping(bytes32 => RentDomainV1.Period[]) public period;
    // nft + id + startTime + endTime
    mapping(bytes32 => RentDomainV1.Pending) public tokenToClaim;

    function getCompleted(bytes32 key) external view returns (bool) {
        return completed[key];
    }

    function setCompleted(
        bytes32 key,
        bool newCompleted
    ) external onlyOperator {
        completed[key] = newCompleted;
    }

    function getPeriods(
        bytes32 key
    ) external view returns (RentDomainV1.Period[] memory) {
        return period[key];
    }

    function pushPeriod(
        bytes32 key,
        RentDomainV1.Period calldata newPeriod
    ) external onlyOperator {
        period[key].push(newPeriod);
    }

    function popPeriod(
        bytes32 key,
        RentDomainV1.Period calldata oldPeriod
    ) external onlyOperator {
        uint index = 0;
        bool found = false;
        for (uint i = 0; i < period[key].length; i++) {
            if (
                period[key][i].startTime == oldPeriod.startTime &&
                period[key][i].endTime == oldPeriod.endTime
            ) {
                index = i;
                found = true;
                break;
            }
        }
        require(found, "period not found");
        period[key][index] = period[key][period[key].length - 1];
        period[key].pop();
    }

    function getTokenToClaim(
        bytes32 key
    ) external view returns (RentDomainV1.Pending memory) {
        return tokenToClaim[key];
    }

    function setTokenToClaim(
        bytes32 key,
        RentDomainV1.Pending calldata newTokenToClaim
    ) external onlyOperator {
        tokenToClaim[key] = newTokenToClaim;
    }
}
