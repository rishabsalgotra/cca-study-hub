// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// Reports whether a shipment has been delivered, e.g. fed by an electronic
/// bill-of-lading registry or a logistics provider's signed API.
interface IDeliveryOracle {
    function isDelivered(bytes32 shipmentId) external view returns (bool);
}

/// @title Trade escrow: "pay when the goods arrive"
/// @notice Works with any ERC-20 cash token: a tokenized deposit or a stablecoin.
contract TradeEscrow {
    using SafeERC20 for IERC20;

    enum State { None, Funded, Released, Refunded }

    struct Deal {
        address buyer;
        address seller;
        IERC20  token;
        uint256 amount;
        bytes32 shipmentId;
        uint64  deadline;
        State   state;
    }

    IDeliveryOracle public immutable oracle;
    mapping(uint256 => Deal) public deals;
    uint256 public nextId;

    event Opened(uint256 indexed id, address indexed buyer, address indexed seller, uint256 amount);
    event Released(uint256 indexed id);
    event Refunded(uint256 indexed id);

    constructor(IDeliveryOracle oracle_) { oracle = oracle_; }

    /// Buyer locks funds. Requires a prior token.approve(escrow, amount).
    function open(address seller, IERC20 token, uint256 amount, bytes32 shipmentId, uint64 deadline)
        external
        returns (uint256 id)
    {
        require(deadline > block.timestamp, "deadline in past");
        id = nextId++;
        deals[id] = Deal(msg.sender, seller, token, amount, shipmentId, deadline, State.Funded);
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit Opened(id, msg.sender, seller, amount);
    }

    /// Anyone (seller, bank, keeper bot) can trigger payout once delivery is proven.
    function release(uint256 id) external {
        Deal storage d = deals[id];
        require(d.state == State.Funded, "not funded");
        require(oracle.isDelivered(d.shipmentId), "not delivered");
        d.state = State.Released;
        d.token.safeTransfer(d.seller, d.amount);
        emit Released(id);
    }

    /// If nothing was delivered by the deadline, the buyer gets the money back.
    function refund(uint256 id) external {
        Deal storage d = deals[id];
        require(d.state == State.Funded, "not funded");
        require(block.timestamp > d.deadline, "deadline not reached");
        require(!oracle.isDelivered(d.shipmentId), "already delivered");
        d.state = State.Refunded;
        d.token.safeTransfer(d.buyer, d.amount);
        emit Refunded(id);
    }
}
