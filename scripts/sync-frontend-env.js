const fs = require("node:fs");
const path = require("node:path");

const ADDRESS_FILE_PATH = path.resolve(__dirname, "../shared/addresses/localhost.json");
const FRONTEND_ENV_PATH = path.resolve(__dirname, "../frontend/.env.local");

function assertAddress(value, keyName) {
  if (typeof value !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`Missing or invalid address for ${keyName} in shared/addresses/localhost.json`);
  }
}

function readLocalAddressFile() {
  if (!fs.existsSync(ADDRESS_FILE_PATH)) {
    throw new Error(
      "Missing shared/addresses/localhost.json. Run blockchain deployment first: npm run deploy:localhost"
    );
  }

  return JSON.parse(fs.readFileSync(ADDRESS_FILE_PATH, "utf8"));
}

function main() {
  const addresses = readLocalAddressFile();

  assertAddress(addresses.MusicRightsNFT, "MusicRightsNFT");
  assertAddress(addresses.RoyaltyManager, "RoyaltyManager");
  assertAddress(addresses.RightsAuction, "RightsAuction");

  const chainId = Number.isFinite(Number(addresses.chainId)) ? Number(addresses.chainId) : 31337;

  const output = [
    `NEXT_PUBLIC_CHAIN_ID=${chainId}`,
    "NEXT_PUBLIC_NETWORK_NAME=Hardhat Local",
    "NEXT_PUBLIC_LOCAL_RPC_URL=http://127.0.0.1:8545",
    `NEXT_PUBLIC_MUSIC_RIGHTS_NFT=${addresses.MusicRightsNFT}`,
    `NEXT_PUBLIC_ROYALTY_MANAGER=${addresses.RoyaltyManager}`,
    `NEXT_PUBLIC_RIGHTS_AUCTION=${addresses.RightsAuction}`,
    "",
  ].join("\n");

  fs.writeFileSync(FRONTEND_ENV_PATH, output, "utf8");
  console.log(`Synced frontend env file: ${FRONTEND_ENV_PATH}`);
}

main();