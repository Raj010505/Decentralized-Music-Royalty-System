# Frontend dApp

Next.js + TypeScript UI for the Music Royalty & Auction System.

## Pages

- `/` overview with guided end-to-end demo status
- `/register` register track and mint rights NFT
- `/stream` quote and simulate stream royalty payouts
- `/auctions` create, bid, finalize, cancel, and withdraw refunds
- `/my-rights` scan wallet rights portfolio
- `/history` wallet/all on-chain event timeline

## Environment

Main runtime values are in `frontend/.env.local`.

This file is auto-generated from deployment output by:

```powershell
cd ..\blockchain
npm run deploy:localhost
```

Or manually from repository root:

```powershell
npm run sync:frontend-env
```

## Run

```powershell
npm run dev
```

Open `http://localhost:3000`.

## Quality Checks

```powershell
npm run lint
npm run build
```

## Wallet

Use MetaMask on Hardhat Local (`chainId 31337`, `rpc http://127.0.0.1:8545`).

The app includes:

- network switch handling
- readable error decoding for contract/user errors
- auto-refresh controls for guided status and live data panels
