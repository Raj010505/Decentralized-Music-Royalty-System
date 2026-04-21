# Music Royalty & Auction System

Full local-first dApp with production-style Solidity contracts, automated deployment outputs, seeded demo data, and a complete Next.js interface for:

- Track registration and rights NFT minting
- Royalty split quoting and play simulation payouts
- Rights NFT auctions with bidding, refunds, and finalization
- Wallet-scoped event history
- Rights portfolio scanning

## Workspace Structure

- `blockchain/` Hardhat contracts, deployment scripts, and tests
- `frontend/` Next.js dApp UI (TypeScript + ethers v6)
- `shared/addresses/` generated deployment addresses
- `shared/abi/` generated contract ABIs
- `scripts/sync-frontend-env.js` sync utility for frontend env values

## Prerequisites

- Node.js LTS (18+ recommended)
- npm
- MetaMask extension (for browser wallet transactions)

## One-Time Install

From repository root:

```powershell
npm run install:all
```

## Start The Product (Exact Commands)

Open 3 terminals.

Terminal 1 (local blockchain):

```powershell
Set-Location "c:\Users\Raj Dubey\Desktop\bct\blockchain"
npm run node
```

Terminal 2 (compile, test, deploy, seed):

```powershell
Set-Location "c:\Users\Raj Dubey\Desktop\bct\blockchain"
npm run compile
npm run test
npm run deploy:localhost
npm run seed:localhost
```

Notes:

- `npm run deploy:localhost` now auto-syncs `frontend/.env.local` from `shared/addresses/localhost.json`.
- If you redeploy while frontend is running, restart the frontend dev server so new env values are loaded.

Terminal 3 (frontend):

```powershell
Set-Location "c:\Users\Raj Dubey\Desktop\bct\frontend"
npm run dev
```

Open the app at `http://localhost:3000`.

## MetaMask Setup (Local Hardhat)

1. Add network manually:
   - Network Name: `Hardhat Local`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Currency Symbol: `ETH`
2. Import funded Hardhat dev account (local only):

```text
0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

## Product Demo Flow

1. Go to Register and create a track.
2. Go to Stream Sim and run 1000 plays.
3. Go to Auctions and create an auction for token 1.
4. Place bid(s) from another account.
5. Finalize auction after end time.
6. Check History and My Rights pages for updated ownership and payments.

## Validation Commands

From repository root:

```powershell
npm run test:blockchain
npm run lint:frontend
npm run build:frontend
```

Or run all checks:

```powershell
npm run verify
```

## Troubleshooting

- MetaMask shows `0 ETH`: switch to imported funded Hardhat account.
- Network mismatch errors: use in-app network switch button.
- Frontend does not reflect redeploy: rerun deploy and restart frontend.
- Missing `shared/addresses/localhost.json`: deploy contracts before seeding or env sync.
