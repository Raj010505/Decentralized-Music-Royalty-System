const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("End-to-End Music Royalty + Auction Flow", function () {
  async function deployFixture() {
    const [owner, singer, producer, fanOne, fanTwo, bidderOne, bidderTwo] = await ethers.getSigners();

    const nftFactory = await ethers.getContractFactory("MusicRightsNFT");
    const nft = await nftFactory.deploy();

    const royaltyFactory = await ethers.getContractFactory("RoyaltyManager");
    const royaltyManager = await royaltyFactory.deploy(await nft.getAddress());

    await nft.setRoyaltyManager(await royaltyManager.getAddress());

    const auctionFactory = await ethers.getContractFactory("RightsAuction");
    const auction = await auctionFactory.deploy(await nft.getAddress(), await royaltyManager.getAddress());

    await royaltyManager.setAuctionContract(await auction.getAddress());

    return { nft, royaltyManager, auction, owner, singer, producer, fanOne, fanTwo, bidderOne, bidderTwo };
  }

  async function registerTrack(royaltyManager, owner, singer, producer, ratePerPlay) {
    const splitAccounts = [owner.address, singer.address, producer.address];
    const splitBps = [5000, 3000, 2000];

    const tokenId = await royaltyManager.connect(owner).registerTrack.staticCall(
      "E2E Song",
      "ipfs://e2e-song",
      splitAccounts,
      splitBps,
      0,
      ratePerPlay
    );

    await royaltyManager.connect(owner).registerTrack(
      "E2E Song",
      "ipfs://e2e-song",
      splitAccounts,
      splitBps,
      0,
      ratePerPlay
    );

    return tokenId;
  }

  it("handles registration, streaming royalties, auction transfer, and post-sale royalties", async function () {
    const { nft, royaltyManager, auction, owner, singer, producer, fanOne, fanTwo, bidderOne, bidderTwo } =
      await deployFixture();

    const ratePerPlay = ethers.parseEther("0.001");
    const tokenId = await registerTrack(royaltyManager, owner, singer, producer, ratePerPlay);

    const initialPlays = 1000;
    const initialTotalCost = ratePerPlay * BigInt(initialPlays);

    const ownerBeforeInitial = await ethers.provider.getBalance(owner.address);
    const singerBeforeInitial = await ethers.provider.getBalance(singer.address);
    const producerBeforeInitial = await ethers.provider.getBalance(producer.address);

    await royaltyManager.connect(fanOne).simulatePlays(tokenId, initialPlays, { value: initialTotalCost });

    const ownerAfterInitial = await ethers.provider.getBalance(owner.address);
    const singerAfterInitial = await ethers.provider.getBalance(singer.address);
    const producerAfterInitial = await ethers.provider.getBalance(producer.address);

    const ownerShareInitial = (initialTotalCost * 5000n) / 10_000n;
    const singerShareInitial = (initialTotalCost * 3000n) / 10_000n;
    const producerShareInitial = initialTotalCost - ownerShareInitial - singerShareInitial;

    expect(ownerAfterInitial - ownerBeforeInitial).to.equal(ownerShareInitial);
    expect(singerAfterInitial - singerBeforeInitial).to.equal(singerShareInitial);
    expect(producerAfterInitial - producerBeforeInitial).to.equal(producerShareInitial);

    await nft.connect(owner).approve(await auction.getAddress(), tokenId);
    await auction.connect(owner).createAuction(tokenId, ethers.parseEther("1"), 3600);
    await auction.connect(bidderOne).placeBid(tokenId, { value: ethers.parseEther("1.2") });
    await auction.connect(bidderTwo).placeBid(tokenId, { value: ethers.parseEther("1.6") });

    await time.increase(3601);
    await auction.connect(fanTwo).finalizeAuction(tokenId);

    expect(await nft.ownerOf(tokenId)).to.equal(bidderTwo.address);
    expect(await royaltyManager.rightsHolderOf(tokenId)).to.equal(bidderTwo.address);

    const postSalePlays = 500;
    const postSaleCost = ratePerPlay * BigInt(postSalePlays);

    const oldOwnerBeforePostSale = await ethers.provider.getBalance(owner.address);
    const bidderTwoBeforePostSale = await ethers.provider.getBalance(bidderTwo.address);
    const singerBeforePostSale = await ethers.provider.getBalance(singer.address);
    const producerBeforePostSale = await ethers.provider.getBalance(producer.address);

    await royaltyManager.connect(fanTwo).simulatePlays(tokenId, postSalePlays, { value: postSaleCost });

    const oldOwnerAfterPostSale = await ethers.provider.getBalance(owner.address);
    const bidderTwoAfterPostSale = await ethers.provider.getBalance(bidderTwo.address);
    const singerAfterPostSale = await ethers.provider.getBalance(singer.address);
    const producerAfterPostSale = await ethers.provider.getBalance(producer.address);

    const winnerOwnerShare = (postSaleCost * 5000n) / 10_000n;
    const singerSharePostSale = (postSaleCost * 3000n) / 10_000n;
    const producerSharePostSale = postSaleCost - winnerOwnerShare - singerSharePostSale;

    expect(oldOwnerAfterPostSale - oldOwnerBeforePostSale).to.equal(0);
    expect(bidderTwoAfterPostSale - bidderTwoBeforePostSale).to.equal(winnerOwnerShare);
    expect(singerAfterPostSale - singerBeforePostSale).to.equal(singerSharePostSale);
    expect(producerAfterPostSale - producerBeforePostSale).to.equal(producerSharePostSale);

    const info = await royaltyManager.getTrackInfo(tokenId);
    expect(info.totalPlays).to.equal(initialPlays + postSalePlays);
    expect(info.totalRoyaltyPaidWei).to.equal(initialTotalCost + postSaleCost);
  });
});
