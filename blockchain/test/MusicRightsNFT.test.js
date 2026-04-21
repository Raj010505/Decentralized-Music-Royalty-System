const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MusicRightsNFT", function () {
  async function deployFixture() {
    const [owner, user] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("MusicRightsNFT");
    const nft = await factory.deploy();

    return { nft, owner, user };
  }

  it("lets owner set royalty manager and mint a track", async function () {
    const { nft, owner } = await deployFixture();

    await nft.setRoyaltyManager(owner.address);
    await nft.mintTrack(owner.address, "ipfs://song-1");

    expect(await nft.ownerOf(1)).to.equal(owner.address);
    expect(await nft.tokenURI(1)).to.equal("ipfs://song-1");
    expect(await nft.nextTokenId()).to.equal(2);
  });

  it("blocks minting from non-manager addresses", async function () {
    const { nft, owner, user } = await deployFixture();

    await nft.setRoyaltyManager(owner.address);

    await expect(nft.connect(user).mintTrack(user.address, "ipfs://song-2"))
      .to.be.revertedWithCustomError(nft, "NotRoyaltyManager");
  });

  it("blocks non-owner from setting royalty manager", async function () {
    const { nft, user } = await deployFixture();

    await expect(nft.connect(user).setRoyaltyManager(user.address))
      .to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount");
  });
});
