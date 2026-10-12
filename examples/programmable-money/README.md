# Programmable Money: sample contracts & tests

Source for the code shown on [`topics/programmable-money.html`](../../topics/programmable-money.html).
These are teaching samples. They have not been audited, so don't use them in production.

```
contracts/   TokenizedDeposit, ReserveBackedStablecoin, TradeEscrow, DvPSettlement,
             PurposeBoundGrant, TreasurySweep, PayrollStream, Mocks (test doubles)
test/        Hardhat tests (escrow runs against both a deposit token and a stablecoin)
snippets/    Off-chain TypeScript integration examples (illustrative, not run)
page.template.html + build.py   regenerate the topic page with this code inlined
```

## Run the tests

```sh
npm install
npm test          # compiles with solc 0.8.26 + OpenZeppelin 5.1, runs 10 tests
```

## Rebuild the topic page

Edit the contracts, snippets, or `page.template.html`, then:

```sh
python3 build.py  # writes ../../topics/programmable-money.html
```
