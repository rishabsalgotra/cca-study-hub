const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Programmable money", function () {
  let bank, compliance, buyer, seller, outsider;
  let aUSD, xUSD, oracle, feed, escrow;
  const SHIP = ethers.id("BL-2026-000123");             // bill-of-lading id
  const REF = ethers.encodeBytes32String("CORE-TX-1");  // core banking reference

  beforeEach(async () => {
    [bank, compliance, buyer, seller, outsider] = await ethers.getSigners();

    // Variant 1: tokenized deposit (permissioned)
    aUSD = await ethers.deployContract("TokenizedDeposit", [bank.address]);
    await aUSD.grantRole(await aUSD.ISSUER_ROLE(), bank.address);
    await aUSD.grantRole(await aUSD.COMPLIANCE_ROLE(), compliance.address);

    // Variant 2: stablecoin (permissionless, reserve-capped)
    feed = await ethers.deployContract("MockReserveFeed");
    xUSD = await ethers.deployContract("ReserveBackedStablecoin", [bank.address, await feed.getAddress()]);
    await xUSD.grantRole(await xUSD.MINTER_ROLE(), bank.address);

    oracle = await ethers.deployContract("MockDeliveryOracle");
    escrow = await ethers.deployContract("TradeEscrow", [await oracle.getAddress()]);
  });

  it("tokenized deposit: only allowlisted holders can transact", async () => {
    await aUSD.connect(compliance).setAllowlisted(buyer.address, true);
    await aUSD.mint(buyer.address, 100_00, REF);                        // $100.00
    await expect(aUSD.connect(buyer).transfer(outsider.address, 1))
      .to.be.revertedWith("receiver not permitted");
  });

  it("stablecoin: cannot mint beyond attested reserves", async () => {
    await feed.set(1_000_000n * 10n ** 6n);                             // $1m in reserve
    await xUSD.mint(buyer.address, 1_000_000n * 10n ** 6n);
    await expect(xUSD.mint(buyer.address, 1)).to.be.revertedWith("exceeds reserves");
    await xUSD.connect(buyer).transfer(outsider.address, 5n * 10n ** 6n); // anyone can receive
    expect(await xUSD.balanceOf(outsider.address)).to.equal(5n * 10n ** 6n);
  });

  for (const variant of ["tokenized deposit", "stablecoin"]) {
    it(`escrow pays seller after delivery (${variant})`, async () => {
      let token;
      if (variant === "tokenized deposit") {
        token = aUSD;
        // The escrow contract itself must be allowlisted to hold deposit tokens.
        for (const a of [buyer.address, seller.address, await escrow.getAddress()])
          await aUSD.connect(compliance).setAllowlisted(a, true);
        await aUSD.mint(buyer.address, 50_000_00, REF);
      } else {
        token = xUSD;
        await feed.set(50_000n * 10n ** 6n);
        await xUSD.mint(buyer.address, 50_000n * 10n ** 6n);
      }
      const amount = await token.balanceOf(buyer.address);
      const deadline = (await time.latest()) + 30 * 24 * 3600;

      await token.connect(buyer).approve(await escrow.getAddress(), amount);
      await escrow.connect(buyer).open(seller.address, await token.getAddress(), amount, SHIP, deadline);
      await expect(escrow.release(0)).to.be.revertedWith("not delivered");

      await oracle.setDelivered(SHIP, true);                             // carrier confirms
      await escrow.connect(outsider).release(0);                         // anyone can trigger
      expect(await token.balanceOf(seller.address)).to.equal(amount);
    });
  }

  it("escrow refunds buyer after the deadline", async () => {
    await feed.set(1_000n * 10n ** 6n);
    await xUSD.mint(buyer.address, 1_000n * 10n ** 6n);
    const deadline = (await time.latest()) + 3600;
    await xUSD.connect(buyer).approve(await escrow.getAddress(), 1_000n * 10n ** 6n);
    await escrow.connect(buyer).open(seller.address, await xUSD.getAddress(), 1_000n * 10n ** 6n, SHIP, deadline);
    await time.increase(3601);
    await escrow.refund(0);
    expect(await xUSD.balanceOf(buyer.address)).to.equal(1_000n * 10n ** 6n);
  });

  it("DvP settles bond and cash atomically", async () => {
    const dvp = await ethers.deployContract("DvPSettlement");
    const bond = await ethers.deployContract("MockBond", [seller.address]);
    await feed.set(99_000n * 10n ** 6n);
    await xUSD.mint(buyer.address, 99_000n * 10n ** 6n);

    const expiry = (await time.latest()) + 3600;
    await dvp.connect(seller).propose(seller.address, buyer.address,
      await bond.getAddress(), 100, await xUSD.getAddress(), 99_000n * 10n ** 6n, expiry);
    await bond.connect(seller).approve(await dvp.getAddress(), 100);
    await xUSD.connect(buyer).approve(await dvp.getAddress(), 99_000n * 10n ** 6n);

    await dvp.connect(seller).affirm(0);
    await dvp.connect(buyer).affirm(0);                                  // settles both legs
    expect(await bond.balanceOf(buyer.address)).to.equal(100);
    expect(await xUSD.balanceOf(seller.address)).to.equal(99_000n * 10n ** 6n);
  });

  it("DvP reverts BOTH legs if one leg fails", async () => {
    const dvp = await ethers.deployContract("DvPSettlement");
    const bond = await ethers.deployContract("MockBond", [seller.address]);
    const expiry = (await time.latest()) + 3600;
    await dvp.connect(seller).propose(seller.address, buyer.address,
      await bond.getAddress(), 100, await xUSD.getAddress(), 1n, expiry);
    await bond.connect(seller).approve(await dvp.getAddress(), 100);
    await dvp.connect(seller).affirm(0);
    await expect(dvp.connect(buyer).affirm(0)).to.be.reverted;           // buyer has no cash
    expect(await bond.balanceOf(seller.address)).to.equal(1_000);        // bond never moved
  });
});
