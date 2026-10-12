// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Pausable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title Bank A USD deposit token
/// @notice Each token is a deposit liability of Bank A, mirrored 1:1 by an
///         omnibus account in the core banking system. Only KYC'd customers
///         (and approved contracts such as escrows) can hold or move it.
contract TokenizedDeposit is ERC20, ERC20Pausable, AccessControl {
    bytes32 public constant ISSUER_ROLE     = keccak256("ISSUER_ROLE");     // treasury ops: mint
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE"); // allowlist, freeze

    mapping(address => bool) public allowlisted;
    mapping(address => bool) public frozen;

    event Minted(address indexed to, uint256 amount, bytes32 indexed coreRef);
    event RedemptionRequested(address indexed from, uint256 amount, bytes32 indexed accountRef);

    constructor(address admin) ERC20("Bank A USD Deposit", "aUSD") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// Same precision as the core ledger (cents).
    function decimals() public pure override returns (uint8) { return 2; }

    /// Called only after core banking has debited the customer's account
    /// and credited the token omnibus account. coreRef = core transaction id.
    function mint(address to, uint256 amount, bytes32 coreRef) external onlyRole(ISSUER_ROLE) {
        _mint(to, amount);
        emit Minted(to, amount, coreRef);
    }

    /// Holder converts tokens back to a normal deposit. The bank's listener
    /// sees the event and credits the account identified by accountRef.
    function redeem(uint256 amount, bytes32 accountRef) external {
        _burn(msg.sender, amount);
        emit RedemptionRequested(msg.sender, amount, accountRef);
    }

    function setAllowlisted(address account, bool ok) external onlyRole(COMPLIANCE_ROLE) {
        allowlisted[account] = ok;
    }

    function setFrozen(address account, bool isFrozen) external onlyRole(COMPLIANCE_ROLE) {
        frozen[account] = isFrozen;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    /// Every mint, burn and transfer passes through this hook (OpenZeppelin v5).
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Pausable)
    {
        if (from != address(0)) require(allowlisted[from] && !frozen[from], "sender not permitted");
        if (to != address(0))   require(allowlisted[to] && !frozen[to], "receiver not permitted");
        super._update(from, to, value);
    }
}
