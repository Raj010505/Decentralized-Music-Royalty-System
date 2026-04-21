# Blockchain (Hardhat)

## Commands

- `npm run clean` remove build artifacts
- `npm run compile` compile contracts
- `npm run test` run all Solidity tests
- `npm run node` start local blockchain (`http://127.0.0.1:8545`)
- `npm run deploy:localhost` deploy contracts to running local node and sync frontend env
- `npm run deploy:hardhat` deploy to ephemeral in-memory network
- `npm run seed:localhost` seed demo track and default royalty split

## Typical Local Sequence

Terminal 1:

```powershell
npm run node
```

Terminal 2:

```powershell
npm run compile
npm run test
npm run deploy:localhost
npm run seed:localhost
```

## Contracts

- `contracts/MusicRightsNFT.sol` ERC721 rights token
- `contracts/RoyaltyManager.sol` registration, split logic, and stream payout simulation
- `contracts/RightsAuction.sol` rights auction lifecycle and bidder refunds

## Deployment Outputs

After `npm run deploy:localhost`:

- `../shared/addresses/localhost.json`
- `../shared/abi/MusicRightsNFT.json`
- `../shared/abi/RoyaltyManager.json`
- `../shared/abi/RightsAuction.json`
- `../frontend/.env.local` (auto-synced)
