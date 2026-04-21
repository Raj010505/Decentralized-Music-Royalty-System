const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RoyaltyManager", function () {
  async function deployFixture() {
    const [owner, singer, producer, fan, outsider] = await ethers.getSigners();

    const nftFactory = await ethers.getContractFactory("MusicRightsNFT");
    const nft = await nftFactory.deploy();

    const royaltyFactory = await ethers.getContractFactory("RoyaltyManager");
    const royaltyManager = await royaltyFactory.deploy(await nft.getAddress());

    await nft.setRoyaltyManager(await royaltyManager.getAddress());

    return { nft, royaltyManager, owner, singer, producer, fan, outsider };
  }

  async function registerDefaultTrack(royaltyManager, owner, singer, producer) {
    const accounts = [owner.address, singer.address, producer.address];
    const bps = [5000, 3000, 2000];
    const ratePerPlay = ethers.parseEther("0.001");

    const tokenId = await royaltyManager.connect(owner).registerTrack.staticCall(
      "Track A",
      "ipfs://track-a",
      accounts,
      bps,
      0,
      ratePerPlay
    );

    await royaltyManager.connect(owner).registerTrack(
      "Track A",
      "ipfs://track-a",
      accounts,
      bps,
      0,
      ratePerPlay
    );

    return { tokenId, ratePerPlay };
  }

  it("registers a track with valid splits", async function () {
    const { royaltyManager, owner, singer, producer } = await deployFixture();
    const { tokenId, ratePerPlay } = await registerDefaultTrack(royaltyManager, owner, singer, producer);

    const info = await royaltyManager.getTrackInfo(tokenId);
    expect(info.title).to.equal("Track A");
    expect(info.ratePerPlayWei).to.equal(ratePerPlay);
    expect(info.totalPlays).to.equal(0);
    expect(info.totalRoyaltyPaidWei).to.equal(0);

    const [accounts, bps] = await royaltyManager.getTrackSplits(tokenId);
    expect(accounts[0]).to.equal(owner.address);
    expect(accounts[1]).to.equal(singer.address);
    expect(accounts[2]).to.equal(producer.address);
    expect(bps[0]).to.equal(5000);
    expect(bps[1]).to.equal(3000);
    expect(bps[2]).to.equal(2000);
  });

  it("rejects invalid split totals", async function () {
    const { royaltyManager, owner, singer, producer } = await deployFixture();

    await expect(
      royaltyManager.connect(owner).registerTrack(
        "Bad Split Track",
        "ipfs://bad",
        [owner.address, singer.address, producer.address],
        [5000, 2000, 2000],
        0,
        ethers.parseEther("0.001")
      )
    ).to.be.revertedWithCustomError(royaltyManager, "InvalidBpsTotal");
  });

  it("simulates plays and distributes royalties by split", async function () {
    const { royaltyManager, owner, singer, producer, fan } = await deployFixture();
    const { tokenId, ratePerPlay } = await registerDefaultTrack(royaltyManager, owner, singer, producer);

    const plays = 1000;
    const totalCost = ratePerPlay * BigInt(plays);
    const ownerShare = (totalCost * 5000n) / 10_000n;
    const singerShare = (totalCost * 3000n) / 10_000n;
    const producerShare = totalCost - ownerShare - singerShare;

    const ownerBefore = await ethers.provider.getBalance(owner.address);
    const singerBefore = await ethers.provider.getBalance(singer.address);
    const producerBefore = await ethers.provider.getBalance(producer.address);

    await royaltyManager.connect(fan).simulatePlays(tokenId, plays, { value: totalCost });

    const ownerAfter = await ethers.provider.getBalance(owner.address);
    const singerAfter = await ethers.provider.getBalance(singer.address);
    const producerAfter = await ethers.provider.getBalance(producer.address);

    expect(ownerAfter - ownerBefore).to.equal(ownerShare);
    expect(singerAfter - singerBefore).to.equal(singerShare);
    expect(producerAfter - producerBefore).to.equal(producerShare);

    const info = await royaltyManager.getTrackInfo(tokenId);
    expect(info.totalPlays).to.equal(plays);
    expect(info.totalRoyaltyPaidWei).to.equal(totalCost);

    const managerBalance = await ethers.provider.getBalance(await royaltyManager.getAddress());
    expect(managerBalance).to.equal(0);
  });

  it("only allows auction contract to update rights holder", async function () {
    const { royaltyManager, owner, singer, producer, outsider } = await deployFixture();
    const { tokenId } = await registerDefaultTrack(royaltyManager, owner, singer, producer);

    await expect(
      royaltyManager.connect(outsider).updateRightsHolderFromAuction(tokenId, outsider.address)
    ).to.be.revertedWithCustomError(royaltyManager, "NotAuction");
  });
});
