const fs = require("node:fs");
const path = require("node:path");
const hre = require("hardhat");

function loadLocalAddressFile() {
  const addressFilePath = path.resolve(__dirname, "../../shared/addresses/localhost.json");
  if (!fs.existsSync(addressFilePath)) {
    throw new Error(
      "Missing shared/addresses/localhost.json. Run npm run deploy:localhost first while node is running."
    );
  }

  return JSON.parse(fs.readFileSync(addressFilePath, "utf8"));
}

async function main() {
  const [rightsHolder, singer, producer] = await hre.ethers.getSigners();
  const addresses = loadLocalAddressFile();

  if (!addresses.RoyaltyManager) {
    throw new Error("RoyaltyManager address is missing from shared/addresses/localhost.json");
  }

  const royaltyManager = await hre.ethers.getContractAt("RoyaltyManager", addresses.RoyaltyManager);
  const splitAccounts = [rightsHolder.address, singer.address, producer.address];
  const splitBps = [5000, 3000, 2000];

  const tokenId = await royaltyManager.connect(rightsHolder).registerTrack.staticCall(
    "Demo Song #1",
    "ipfs://demo-song-1",
    splitAccounts,
    splitBps,
    0,
    hre.ethers.parseEther("0.00001")
  );

  const tx = await royaltyManager.connect(rightsHolder).registerTrack(
    "Demo Song #1",
    "ipfs://demo-song-1",
    splitAccounts,
    splitBps,
    0,
    hre.ethers.parseEther("0.00001")
  );
  await tx.wait();

  console.log("Seeded demo track successfully");
  console.log(`Token ID: ${tokenId}`);
  console.log(`Rights holder: ${rightsHolder.address}`);
  console.log(`Singer: ${singer.address}`);
  console.log(`Producer: ${producer.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
