// reconcile.ts — the one invariant a deposit-token bank must never break
//   on-chain totalSupply  ==  balance of the token omnibus account in core banking
async function reconcile() {
  const onChain: bigint = await aUSD.totalSupply();
  const omnibus: bigint = BigInt(await coreBanking.balance("TOKEN-OMNIBUS-USD"));

  if (onChain !== omnibus) {
    await alerts.page("token-ops", { onChain, omnibus, diff: onChain - omnibus });
    await aUSD.connect(adminSigner).pause();     // stop the bleeding, then investigate
  }
}
setInterval(reconcile, 60_000);                  // every minute, 24/7
