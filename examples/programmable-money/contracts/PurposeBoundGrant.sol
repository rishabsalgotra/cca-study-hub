// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title Purpose-bound money: a grant that can only be spent with approved
///        merchants before an expiry date. Unspent funds return to the sponsor.
/// @dev The underlying money stays a normal token; the PURPOSE lives in this
///      wrapper, so it can be removed without changing the money itself.
contract PurposeBoundGrant {
    using SafeERC20 for IERC20;

    IERC20  public immutable money;
    address public immutable sponsor;
    uint64  public immutable expiry;

    mapping(address => uint256) public spendable;        // beneficiary => amount
    mapping(address => bool)    public approvedMerchant; // e.g. pharmacies, schools

    event Allocated(address indexed beneficiary, uint256 amount);
    event Spent(address indexed beneficiary, address indexed merchant, uint256 amount);
    event Reclaimed(uint256 amount);

    modifier onlySponsor() { require(msg.sender == sponsor, "only sponsor"); _; }

    constructor(IERC20 money_, address sponsor_, uint64 expiry_) {
        money = money_;
        sponsor = sponsor_;
        expiry = expiry_;
    }

    function setMerchant(address merchant, bool ok) external onlySponsor {
        approvedMerchant[merchant] = ok;
    }

    function allocate(address beneficiary, uint256 amount) external onlySponsor {
        require(block.timestamp <= expiry, "expired");
        money.safeTransferFrom(sponsor, address(this), amount);
        spendable[beneficiary] += amount;
        emit Allocated(beneficiary, amount);
    }

    function spend(address merchant, uint256 amount) external {
        require(block.timestamp <= expiry, "expired");
        require(approvedMerchant[merchant], "merchant not approved");
        spendable[msg.sender] -= amount; // reverts on underflow (Solidity 0.8)
        money.safeTransfer(merchant, amount);
        emit Spent(msg.sender, merchant, amount);
    }

    function reclaim() external onlySponsor {
        require(block.timestamp > expiry, "not expired");
        uint256 left = money.balanceOf(address(this));
        money.safeTransfer(sponsor, left);
        emit Reclaimed(left);
    }
}
