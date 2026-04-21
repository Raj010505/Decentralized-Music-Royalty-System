// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./RoyaltyManager.sol";

contract RightsAuction is IERC721Receiver, ReentrancyGuard {
    struct Auction {
        address seller;
        uint256 minBidWei;
        uint256 endTime;
        address highestBidder;
        uint256 highestBidWei;
        bool active;
    }

    IERC721 public immutable musicRightsNFT;
    RoyaltyManager public immutable royaltyManager;

    mapping(uint256 => Auction) public auctions;
    mapping(address => uint256) public pendingReturns;

    error AuctionAlreadyActive();
    error AuctionNotActive();
    error AuctionEnded();
    error AuctionStillRunning();
    error BidTooLow(uint256 requiredMinBid);
    error NotSeller();
    error AuctionHasBids();
    error InvalidDuration();
    error InvalidBid();
    error NothingToWithdraw();
    error TransferFailed(address recipient, uint256 amount);

    event AuctionCreated(
        uint256 indexed tokenId,
        address indexed seller,
        uint256 minBidWei,
        uint256 endTime
    );
    event BidPlaced(uint256 indexed tokenId, address indexed bidder, uint256 bidWei);
    event BidRefunded(address indexed bidder, uint256 amountWei);
    event AuctionCancelled(uint256 indexed tokenId, address indexed seller);
    event AuctionFinalized(
        uint256 indexed tokenId,
        address indexed seller,
        address indexed winner,
        uint256 finalBidWei
    );

    constructor(address musicRightsNftAddress, address royaltyManagerAddress) {
        if (musicRightsNftAddress == address(0) || royaltyManagerAddress == address(0)) {
            revert InvalidBid();
        }

        musicRightsNFT = IERC721(musicRightsNftAddress);
        royaltyManager = RoyaltyManager(royaltyManagerAddress);
    }

    function createAuction(uint256 tokenId, uint256 minBidWei, uint256 durationSeconds) external {
        if (minBidWei == 0) {
            revert InvalidBid();
        }
        if (durationSeconds == 0) {
            revert InvalidDuration();
        }

        Auction storage existingAuction = auctions[tokenId];
        if (existingAuction.active) {
            revert AuctionAlreadyActive();
        }

        if (musicRightsNFT.ownerOf(tokenId) != msg.sender) {
            revert NotSeller();
        }

        uint256 endTime = block.timestamp + durationSeconds;

        auctions[tokenId] = Auction({
            seller: msg.sender,
            minBidWei: minBidWei,
            endTime: endTime,
            highestBidder: address(0),
            highestBidWei: 0,
            active: true
        });

        musicRightsNFT.safeTransferFrom(msg.sender, address(this), tokenId);

        emit AuctionCreated(tokenId, msg.sender, minBidWei, endTime);
    }

    function placeBid(uint256 tokenId) external payable nonReentrant {
        Auction storage auction = auctions[tokenId];
        if (!auction.active) {
            revert AuctionNotActive();
        }
        if (block.timestamp >= auction.endTime) {
            revert AuctionEnded();
        }

        uint256 minimumRequired = auction.highestBidWei == 0 ? auction.minBidWei : auction.highestBidWei + 1;
        if (msg.value < minimumRequired) {
            revert BidTooLow(minimumRequired);
        }

        if (auction.highestBidder != address(0)) {
            pendingReturns[auction.highestBidder] += auction.highestBidWei;
        }

        auction.highestBidder = msg.sender;
        auction.highestBidWei = msg.value;

        emit BidPlaced(tokenId, msg.sender, msg.value);
    }

    function withdrawRefund() external nonReentrant {
        uint256 amount = pendingReturns[msg.sender];
        if (amount == 0) {
            revert NothingToWithdraw();
        }

        pendingReturns[msg.sender] = 0;
        _sendValue(msg.sender, amount);

        emit BidRefunded(msg.sender, amount);
    }

    function cancelAuction(uint256 tokenId) external {
        Auction storage auction = auctions[tokenId];
        if (!auction.active) {
            revert AuctionNotActive();
        }
        if (auction.seller != msg.sender) {
            revert NotSeller();
        }
        if (auction.highestBidder != address(0)) {
            revert AuctionHasBids();
        }

        auction.active = false;
        musicRightsNFT.safeTransferFrom(address(this), auction.seller, tokenId);

        emit AuctionCancelled(tokenId, auction.seller);
    }

    function finalizeAuction(uint256 tokenId) external nonReentrant {
        Auction storage auction = auctions[tokenId];
        if (!auction.active) {
            revert AuctionNotActive();
        }
        if (block.timestamp < auction.endTime) {
            revert AuctionStillRunning();
        }

        auction.active = false;

        if (auction.highestBidder == address(0)) {
            musicRightsNFT.safeTransferFrom(address(this), auction.seller, tokenId);
            emit AuctionFinalized(tokenId, auction.seller, address(0), 0);
            return;
        }

        musicRightsNFT.safeTransferFrom(address(this), auction.highestBidder, tokenId);
        royaltyManager.updateRightsHolderFromAuction(tokenId, auction.highestBidder);
        _sendValue(auction.seller, auction.highestBidWei);

        emit AuctionFinalized(tokenId, auction.seller, auction.highestBidder, auction.highestBidWei);
    }

    function getAuction(uint256 tokenId) external view returns (Auction memory) {
        return auctions[tokenId];
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    function _sendValue(address recipient, uint256 amount) internal {
        (bool success, ) = payable(recipient).call{value: amount}("");
        if (!success) {
            revert TransferFailed(recipient, amount);
        }
    }
}
