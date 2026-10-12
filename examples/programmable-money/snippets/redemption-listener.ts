// redemption-listener.ts — turns burned tokens back into a normal deposit
import { ethers } from "ethers";
import { coreBanking } from "./core-banking-client";

aUSD.on(aUSD.filters.RedemptionRequested(), async (from, amount, accountRef, event) => {
  await coreBanking.postTransfer({
    debit: "TOKEN-OMNIBUS-USD",                  // omnibus shrinks as supply shrinks
    credit: ethers.decodeBytes32String(accountRef),
    amountCents: amount,
    reference: event.log.transactionHash,        // idempotency key on the core side
  });
});
