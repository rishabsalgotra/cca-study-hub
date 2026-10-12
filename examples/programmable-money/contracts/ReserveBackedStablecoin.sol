// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// Attested reserve balance (e.g. a proof-of-reserve feed updated from the
/// custodian banks' statements), in the same 6-decimal units as the token.
interface IReserveFeed {
    function reserves() external view returns (uint256 amount, uint256 updatedAt);
}

/// @title Fiat-backed stablecoin
/// @notice Anyone can hold and transfer it (permissionless), except addresses
///         on the blocklist. New supply can never exceed attested reserves.
contract ReserveBackedStablecoin is ERC20, ERC20Permit, AccessControl {
    bytes32 public constant MINTER_ROLE     = keccak256("MINTER_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");

    IReserveFeed public immutable reserveFeed;
    uint256 public constant MAX_FEED_AGE = 1 days;

    mapping(address => bool) public blocked;

    event Redeemed(address indexed holder, uint256 amount);

    constructor(address admin, IReserveFeed feed)
        ERC20("Example USD", "xUSD")
        ERC20Permit("Example USD")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        reserveFeed = feed;
    }

    function decimals() public pure override returns (uint8) { return 6; }

    /// Issuer mints after fiat has arrived in the reserve account.
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        (uint256 reserveAmount, uint256 updatedAt) = reserveFeed.reserves();
        require(block.timestamp - updatedAt <= MAX_FEED_AGE, "reserve feed stale");
        require(totalSupply() + amount <= reserveAmount, "exceeds reserves");
        _mint(to, amount);
    }

    /// Holder sends tokens back to the issuer to be paid out in fiat off-chain.
    function redeem(uint256 amount) external {
        _burn(msg.sender, amount);
        emit Redeemed(msg.sender, amount);
    }

    function setBlocked(address account, bool isBlocked) external onlyRole(COMPLIANCE_ROLE) {
        blocked[account] = isBlocked;
    }

    function _update(address from, address to, uint256 value) internal override {
        require(!blocked[from] && !blocked[to], "address blocked");
        super._update(from, to, value);
    }
}
