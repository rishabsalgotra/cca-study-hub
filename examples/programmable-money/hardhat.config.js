require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");
module.exports = { solidity: { version: "0.8.26", settings: { evmVersion: "cancun", optimizer: { enabled: true, runs: 200 } } } };
