// mint-service.ts — turns a core-banking debit into on-chain deposit tokens
import express from "express";
import { ethers } from "ethers";
import tokenAbi from "./abi/TokenizedDeposit.json";

const provider = new ethers.JsonRpcProvider(process.env.LEDGER_RPC_URL);
// Production: the issuer key lives in an HSM / MPC signer, never in an env var.
const issuer = new ethers.Wallet(process.env.ISSUER_KEY!, provider);
const aUSD = new ethers.Contract(process.env.AUSD_ADDRESS!, tokenAbi, issuer);

const app = express();
app.use(express.json());

// Core banking calls this AFTER it has debited the customer's account
// and credited the token omnibus account (same amount, same reference).
app.post("/core-events/tokenize", async (req, res) => {
  const { coreTxId, wallet, amountCents } = req.body;
  const coreRef = ethers.id(coreTxId);                      // bytes32 reference

  // Idempotency: the Minted event is indexed by coreRef, so retries are safe.
  const seen = await aUSD.queryFilter(aUSD.filters.Minted(null, null, coreRef));
  if (seen.length > 0) return res.json({ status: "duplicate", txHash: seen[0].transactionHash });

  const tx = await aUSD.mint(wallet, BigInt(amountCents), coreRef);
  const receipt = await tx.wait();
  res.json({ status: "minted", txHash: receipt!.hash });
});

app.listen(8080);
