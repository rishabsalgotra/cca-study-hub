const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
describe("Other sample contracts", () => {
  let admin, a, b, c, feed, usd;
  const U = (n) => BigInt(n) * 10n ** 6n;
  beforeEach(async () => {
    [admin, a, b, c] = await ethers.getSigners();
    feed = await ethers.deployContract("MockReserveFeed");
    usd = await ethers.deployContract("ReserveBackedStablecoin", [admin.address, await feed.getAddress()]);
    await usd.grantRole(await usd.MINTER_ROLE(), admin.address);
    await feed.set(U(1_000_000));
  });
  it("purpose-bound grant", async () => {
    const exp = (await time.latest()) + 1000;
    const g = await ethers.deployContract("PurposeBoundGrant", [await usd.getAddress(), admin.address, exp]);
    await usd.mint(admin.address, U(500));
    await usd.approve(await g.getAddress(), U(500));
    await g.allocate(a.address, U(500));
    await expect(g.connect(a).spend(b.address, U(10))).to.be.revertedWith("merchant not approved");
    await g.setMerchant(b.address, true);
    await g.connect(a).spend(b.address, U(100));
    await expect(g.connect(a).spend(b.address, U(401))).to.be.reverted;
    await time.increase(1001);
    await g.reclaim();
    expect(await usd.balanceOf(admin.address)).to.equal(U(400));
  });
  it("treasury sweep both directions", async () => {
    const s = await ethers.deployContract("TreasurySweep", [await usd.getAddress(), admin.address, c.address]);
    await s.setRule(a.address, U(100), true);
    await usd.mint(a.address, U(250)); await usd.mint(c.address, U(1000));
    await usd.connect(a).approve(await s.getAddress(), ethers.MaxUint256);
    await usd.connect(c).approve(await s.getAddress(), ethers.MaxUint256);
    await s.sweep(a.address);
    expect(await usd.balanceOf(a.address)).to.equal(U(100));
    await usd.connect(a).transfer(b.address, U(80));
    await s.sweep(a.address);
    expect(await usd.balanceOf(a.address)).to.equal(U(100));
    expect(await usd.balanceOf(c.address)).to.equal(U(1070));
  });
  it("payroll stream withdraw + cancel", async () => {
    const p = await ethers.deployContract("PayrollStream", [await usd.getAddress()]);
    const now = await time.latest();
    await usd.mint(admin.address, U(1000));
    await usd.approve(await p.getAddress(), U(1000));
    await p.create(a.address, 1000n, now + 10, now + 10 + 1_000_000); // 1,000 units/s, $1000 total
    await time.increaseTo(now + 10 + 250_000);
    await p.connect(a).withdraw(0);
    await time.increaseTo(now + 10 + 500_000 - 1);
    await p.cancel(0); // at exactly start+500000
    expect(await usd.balanceOf(a.address)).to.equal(U(500));
    expect(await usd.balanceOf(admin.address)).to.equal(U(500));
    await time.increase(1000);
    await p.connect(a).withdraw(0);
    expect(await usd.balanceOf(a.address)).to.equal(U(500));
  });
});
