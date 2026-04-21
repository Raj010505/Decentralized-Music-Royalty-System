const fs = require("node:fs");
const path = require("node:path");
const hre = require("hardhat");

const CONTRACT_NAMES = ["MusicRightsNFT", "RoyaltyManager", "RightsAuction"];

function writeSharedAddressFile(addresses) {
  const addressesDir = path.resolve(__dirname, "../../shared/addresses");
  fs.mkdirSync(addressesDir, { recursive: true });

  const outputPath = path.join(addressesDir, "localhost.json");
  const payload = {
    network: hre.network.name,
    chainId: hre.network.config.chainId || 31337,
    ...addresses,
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
  console.log(`Saved address file: ${outputPath}`);
}

function writeSharedAbiFiles() {
  const sharedAbiDir = path.resolve(__dirname, "../../shared/abi");
  fs.mkdirSync(sharedAbiDir, { recursive: true });

  for (const contractName of CONTRACT_NAMES) {
    const artifactPath = path.resolve(
      __dirname,
      `../artifacts/contracts/${contractName}.sol/${contractName}.json`
    );
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const outputPath = path.join(sharedAbiDir, `${contractName}.json`);

    fs.writeFileSync(
      outputPath,
      JSON.stringify(
        {
          contractName,
          abi: artifact.abi,
        },
        null,
        2
      )
    );

    console.log(`Saved ABI file: ${outputPath}`);
  }
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deploying contracts with wallet: ${deployer.address}`);

  const musicRightsNftFactory = await hre.ethers.getContractFactory("MusicRightsNFT");
  const musicRightsNft = await musicRightsNftFactory.deploy();
  await musicRightsNft.waitForDeployment();

  const musicRightsNftAddress = await musicRightsNft.getAddress();
  console.log(`MusicRightsNFT deployed to: ${musicRightsNftAddress}`);

  const royaltyManagerFactory = await hre.ethers.getContractFactory("RoyaltyManager");
  const royaltyManager = await royaltyManagerFactory.deploy(musicRightsNftAddress);
  await royaltyManager.waitForDeployment();

  const royaltyManagerAddress = await royaltyManager.getAddress();
  console.log(`RoyaltyManager deployed to: ${royaltyManagerAddress}`);

  const setRoyaltyManagerTx = await musicRightsNft.setRoyaltyManager(royaltyManagerAddress);
  await setRoyaltyManagerTx.wait();
  console.log("MusicRightsNFT setRoyaltyManager executed");

  const rightsAuctionFactory = await hre.ethers.getContractFactory("RightsAuction");
  const rightsAuction = await rightsAuctionFactory.deploy(musicRightsNftAddress, royaltyManagerAddress);
  await rightsAuction.waitForDeployment();

  const rightsAuctionAddress = await rightsAuction.getAddress();
  console.log(`RightsAuction deployed to: ${rightsAuctionAddress}`);

  const setAuctionContractTx = await royaltyManager.setAuctionContract(rightsAuctionAddress);
  await setAuctionContractTx.wait();
  console.log("RoyaltyManager setAuctionContract executed");

  writeSharedAddressFile({
    MusicRightsNFT: musicRightsNftAddress,
    RoyaltyManager: royaltyManagerAddress,
    RightsAuction: rightsAuctionAddress,
  });
  writeSharedAbiFiles();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
