// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// Test doubles: in production these are a real logistics feed and a real
/// proof-of-reserve feed signed by the custodian / auditor.
contract MockDeliveryOracle {
    mapping(bytes32 => bool) public isDelivered;
    function setDelivered(bytes32 shipmentId, bool d) external { isDelivered[shipmentId] = d; }
}

contract MockReserveFeed {
    uint256 public amount;
    uint256 public updatedAt;
    function set(uint256 a) external { amount = a; updatedAt = block.timestamp; }
    function reserves() external view returns (uint256, uint256) { return (amount, updatedAt); }
}

contract MockBond is ERC20 {
    constructor(address holder) ERC20("Tokenized 2Y Note", "BOND") { _mint(holder, 1_000); }
    function decimals() public pure override returns (uint8) { return 0; }
}
