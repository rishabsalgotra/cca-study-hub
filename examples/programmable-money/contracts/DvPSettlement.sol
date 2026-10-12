// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title Atomic delivery-versus-payment (also works as payment-versus-payment)
/// @notice Asset leg and cash leg move in ONE transaction: both or neither.
///         asset = tokenized bond / MMF share (DvP) or a second currency token (PvP).
contract DvPSettlement {
    using SafeERC20 for IERC20;

    struct Trade {
        address seller;     // delivers the asset
        address buyer;      // pays the cash
        IERC20  asset;
        uint256 assetQty;
        IERC20  cash;
        uint256 cashAmt;
        uint64  expiry;
        bool    sellerAffirmed;
        bool    buyerAffirmed;
        bool    settled;
    }

    mapping(uint256 => Trade) public trades;
    uint256 public nextId;

    event Proposed(uint256 indexed id);
    event Settled(uint256 indexed id);

    function propose(
        address seller, address buyer,
        IERC20 asset, uint256 assetQty,
        IERC20 cash, uint256 cashAmt,
        uint64 expiry
    ) external returns (uint256 id) {
        require(msg.sender == seller || msg.sender == buyer, "not a party");
        id = nextId++;
        trades[id] = Trade(seller, buyer, asset, assetQty, cash, cashAmt, expiry, false, false, false);
        emit Proposed(id);
    }

    /// Each party affirms after approving this contract for its leg.
    /// The second affirmation settles both legs atomically.
    function affirm(uint256 id) external {
        Trade storage t = trades[id];
        require(!t.settled, "settled");
        require(block.timestamp <= t.expiry, "expired");
        if (msg.sender == t.seller) t.sellerAffirmed = true;
        else if (msg.sender == t.buyer) t.buyerAffirmed = true;
        else revert("not a party");

        if (t.sellerAffirmed && t.buyerAffirmed) {
            t.settled = true;
            t.asset.safeTransferFrom(t.seller, t.buyer, t.assetQty); // delivery
            t.cash.safeTransferFrom(t.buyer, t.seller, t.cashAmt);   // payment
            emit Settled(id);                                        // any failure reverts both
        }
    }
}
