// oracle-keeper.ts — pushes real-world events on-chain, then triggers payout
// Production oracles use several signed sources (carrier + port + eBL registry).
async function checkShipment(dealId: number, billOfLading: string) {
  const doc = await fetch(`${EBL_REGISTRY}/bills/${billOfLading}`, { headers: auth })
    .then((r) => r.json());

  if (doc.status === "DELIVERED" && verifySignature(doc)) {
    await (await oracle.setDelivered(ethers.id(billOfLading), true)).wait();
    await (await escrow.release(dealId)).wait();  // seller is paid in the same minute
  }
}
