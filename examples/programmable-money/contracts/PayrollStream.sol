// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title Salary streaming: pay accrues every second, withdraw any time
contract PayrollStream {
    using SafeERC20 for IERC20;

    struct Stream {
        address employer;
        address employee;
        uint256 ratePerSecond;
        uint64  start;
        uint64  stop;
        uint256 withdrawn;
    }

    IERC20 public immutable cash;
    mapping(uint256 => Stream) public streams;
    uint256 public nextId;

    event Withdrawn(uint256 indexed id, uint256 amount);
    event Cancelled(uint256 indexed id, uint256 toEmployee, uint256 toEmployer);

    constructor(IERC20 cash_) { cash = cash_; }

    /// Employer pre-funds the whole period (e.g. one month of salary).
    function create(address employee, uint256 ratePerSecond, uint64 start, uint64 stop)
        external
        returns (uint256 id)
    {
        require(stop > start, "bad period");
        id = nextId++;
        streams[id] = Stream(msg.sender, employee, ratePerSecond, start, stop, 0);
        cash.safeTransferFrom(msg.sender, address(this), ratePerSecond * (stop - start));
    }

    function earned(uint256 id) public view returns (uint256) {
        Stream memory s = streams[id];
        if (block.timestamp <= s.start) return 0;
        uint256 end = block.timestamp < s.stop ? block.timestamp : s.stop;
        return s.ratePerSecond * (end - s.start);
    }

    function withdraw(uint256 id) external {
        Stream storage s = streams[id];
        require(msg.sender == s.employee, "not employee");
        uint256 amount = earned(id) - s.withdrawn;
        s.withdrawn += amount;
        cash.safeTransfer(s.employee, amount);
        emit Withdrawn(id, amount);
    }

    /// Employer ends the stream: employee keeps what was earned, the rest is refunded.
    function cancel(uint256 id) external {
        Stream storage s = streams[id];
        require(msg.sender == s.employer, "not employer");
        uint256 total = s.ratePerSecond * (s.stop - s.start);
        uint256 earnedNow = earned(id);
        uint256 owed = earnedNow - s.withdrawn;
        uint256 refund = total - earnedNow;
        // Freeze the stream at "now" so nothing more accrues.
        s.withdrawn = earnedNow;
        s.stop = uint64(block.timestamp < s.stop ? block.timestamp : s.stop);
        if (s.stop < s.start) s.stop = s.start;
        cash.safeTransfer(s.employee, owed);
        cash.safeTransfer(s.employer, refund);
        emit Cancelled(id, owed, refund);
    }
}
