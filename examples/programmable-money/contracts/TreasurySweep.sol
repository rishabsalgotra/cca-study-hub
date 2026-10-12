// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title Corporate treasury sweep
/// @notice Keeps each subsidiary wallet at a target balance: excess is swept to
///         the group's concentration wallet, shortfalls are topped up from it.
///         Each subsidiary and the concentration wallet approve this contract.
contract TreasurySweep {
    using SafeERC20 for IERC20;

    struct Rule { uint256 target; bool active; }

    IERC20  public immutable cash;
    address public immutable treasurer;
    address public immutable concentration;
    mapping(address => Rule) public rules;

    event Swept(address indexed subsidiary, int256 moved); // + = to pool, - = to subsidiary

    constructor(IERC20 cash_, address treasurer_, address concentration_) {
        cash = cash_;
        treasurer = treasurer_;
        concentration = concentration_;
    }

    function setRule(address subsidiary, uint256 target, bool active) external {
        require(msg.sender == treasurer, "only treasurer");
        rules[subsidiary] = Rule(target, active);
    }

    /// Called by an automation keeper (e.g. every hour, or at 17:00 local time).
    function sweep(address subsidiary) external {
        Rule memory r = rules[subsidiary];
        require(r.active, "no rule");
        uint256 bal = cash.balanceOf(subsidiary);
        if (bal > r.target) {
            uint256 excess = bal - r.target;
            cash.safeTransferFrom(subsidiary, concentration, excess);
            emit Swept(subsidiary, int256(excess));
        } else if (bal < r.target) {
            uint256 shortfall = r.target - bal;
            cash.safeTransferFrom(concentration, subsidiary, shortfall);
            emit Swept(subsidiary, -int256(shortfall));
        }
    }
}
