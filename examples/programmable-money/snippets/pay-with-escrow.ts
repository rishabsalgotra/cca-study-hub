// pay-with-escrow.ts — a corporate client's ERP pays a supplier "on delivery".
// The ONLY difference between the two variants is which token address you use.
import { ethers } from "ethers";

const TOKENS = {
  deposit:    "0xA0…aUSD",   // Bank A tokenized deposit (permissioned ledger)
  stablecoin: "0xB0…xUSD",   // regulated stablecoin (public chain)
} as const;

export async function payOnDelivery(
  signer: ethers.Signer, rail: keyof typeof TOKENS,
  seller: string, amount: bigint, billOfLading: string, days = 30,
) {
  const token  = new ethers.Contract(TOKENS[rail], erc20Abi, signer);
  const escrow = new ethers.Contract(ESCROW_ADDRESS, escrowAbi, signer);

  await (await token.approve(ESCROW_ADDRESS, amount)).wait();
  const deadline = Math.floor(Date.now() / 1000) + days * 24 * 3600;
  const tx = await escrow.open(seller, TOKENS[rail], amount, ethers.id(billOfLading), deadline);
  return (await tx.wait())!.hash;
}
