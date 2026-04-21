const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("RightsAuction", function () {
  async function deployFixture() {
    const [owner, singer, producer, bidderOne, bidderTwo, outsider] = await ethers.getSigners();

    const nftFactory = await ethers.getContractFactory("MusicRightsNFT");
    const nft = await nftFactory.deploy();

    const royaltyFactory = await ethers.getContractFactory("RoyaltyManager");
    const royaltyManager = await royaltyFactory.deploy(await nft.getAddress());

    await nft.setRoyaltyManager(await royaltyManager.getAddress());

    const auctionFactory = await ethers.getContractFactory("RightsAuction");
    const auction = await auctionFactory.deploy(await nft.getAddress(), await royaltyManager.getAddress());

    await royaltyManager.setAuctionContract(await auction.getAddress());

    return { nft, royaltyManager, auction, owner, singer, producer, bidderOne, bidderTwo, outsider };
  }

  async function registerDefaultTrack(royaltyManager, owner, singer, producer) {
    const accounts = [owner.address, singer.address, producer.address];
    const bps = [5000, 3000, 2000];

    const tokenId = await royaltyManager.connect(owner).registerTrack.staticCall(
      "Auction Track",
      "ipfs://auction-track",
      accounts,
      bps,
      0,
      ethers.parseEther("0.001")
    );

    await royaltyManager.connect(owner).registerTrack(
      "Auction Track",
      "ipfs://auction-track",
      accounts,
      bps,
      0,
      ethers.parseEther("0.001")
    );

    return tokenId;
  }

  it("runs auction bidding and transfers rights to winner", async function () {
    const { nft, royaltyManager, auction, owner, singer, producer, bidderOne, bidderTwo, outsider } =
      await deployFixture();

    const tokenId = await registerDefaultTrack(royaltyManager, owner, singer, producer);

    await nft.connect(owner).approve(await auction.getAddress(), tokenId);

    const minBid = ethers.parseEther("1");
    const winningBid = ethers.parseEther("1.5");

    await auction.connect(owner).createAuction(tokenId, minBid, 3600);
    await auction.connect(bidderOne).placeBid(tokenId, { value: minBid });
    await auction.connect(bidderTwo).placeBid(tokenId, { value: winningBid });

    expect(await auction.pendingReturns(bidderOne.address)).to.equal(minBid);

    await auction.connect(bidderOne).withdrawRefund();
    expect(await auction.pendingReturns(bidderOne.address)).to.equal(0);

    await time.increase(3601);

    const sellerBeforeFinalize = await ethers.provider.getBalance(owner.address);
    await auction.connect(outsider).finalizeAuction(tokenId);
    const sellerAfterFinalize = await ethers.provider.getBalance(owner.address);

    expect(sellerAfterFinalize - sellerBeforeFinalize).to.equal(winningBid);
    expect(await nft.ownerOf(tokenId)).to.equal(bidderTwo.address);
    expect(await royaltyManager.rightsHolderOf(tokenId)).to.equal(bidderTwo.address);
  });

  it("allows seller to cancel when no bids exist", async function () {
    const { nft, royaltyManager, auction, owner, singer, producer } = await deployFixture();

    const tokenId = await registerDefaultTrack(royaltyManager, owner, singer, producer);
    await nft.connect(owner).approve(await auction.getAddress(), tokenId);

    await auction.connect(owner).createAuction(tokenId, ethers.parseEther("1"), 3600);
    await auction.connect(owner).cancelAuction(tokenId);

    expect(await nft.ownerOf(tokenId)).to.equal(owner.address);
    const auctionData = await auction.getAuction(tokenId);
    expect(auctionData.active).to.equal(false);
  });
});
