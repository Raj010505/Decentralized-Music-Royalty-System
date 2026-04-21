// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./MusicRightsNFT.sol";

contract RoyaltyManager is Ownable, ReentrancyGuard {
    uint96 public constant BPS_DENOMINATOR = 10_000;

    struct TrackInfo {
        string title;
        uint256 ratePerPlayWei;
        uint256 totalPlays;
        uint256 totalRoyaltyPaidWei;
        uint256 rightsHolderSplitIndex;
        bool exists;
    }

    struct RoyaltySplit {
        address account;
        uint96 bps;
    }

    MusicRightsNFT public immutable musicRightsNFT;
    address public auctionContract;

    mapping(uint256 => TrackInfo) private _trackInfo;
    mapping(uint256 => RoyaltySplit[]) private _trackSplits;

    error ArrayLengthMismatch();
    error InvalidBpsTotal();
    error InvalidSplit();
    error InvalidRightsHolder();
    error InvalidRatePerPlay();
    error InvalidPlays();
    error TrackNotFound();
    error NotAuction();
    error InsufficientPayment(uint256 expected, uint256 provided);
    error TransferFailed(address recipient, uint256 amount);

    event AuctionContractUpdated(address indexed oldAuctionContract, address indexed newAuctionContract);
    event TrackRegistered(
        uint256 indexed tokenId,
        address indexed rightsHolder,
        string title,
        string metadataURI,
        uint256 ratePerPlayWei
    );
    event RoyaltySplitPaid(uint256 indexed tokenId, address indexed recipient, uint256 amountWei, uint256 plays);
    event RoyaltiesDistributed(
        uint256 indexed tokenId,
        uint256 plays,
        uint256 totalPaidWei,
        address indexed paidBy
    );
    event RightsHolderUpdated(uint256 indexed tokenId, address indexed newRightsHolder);

    constructor(address musicRightsNftAddress) Ownable(msg.sender) {
        if (musicRightsNftAddress == address(0)) {
            revert InvalidSplit();
        }

        musicRightsNFT = MusicRightsNFT(musicRightsNftAddress);
    }

    function setAuctionContract(address newAuctionContract) external onlyOwner {
        if (newAuctionContract == address(0)) {
            revert InvalidSplit();
        }

        address oldAuctionContract = auctionContract;
        auctionContract = newAuctionContract;

        emit AuctionContractUpdated(oldAuctionContract, newAuctionContract);
    }

    function registerTrack(
        string calldata title,
        string calldata metadataURI,
        address[] calldata splitAccounts,
        uint96[] calldata splitBps,
        uint256 rightsHolderSplitIndex,
        uint256 ratePerPlayWei
    ) external returns (uint256 tokenId) {
        uint256 splitCount = splitAccounts.length;

        if (splitCount == 0 || splitCount != splitBps.length) {
            revert ArrayLengthMismatch();
        }
        if (rightsHolderSplitIndex >= splitCount) {
            revert InvalidRightsHolder();
        }
        if (ratePerPlayWei == 0) {
            revert InvalidRatePerPlay();
        }

        uint256 totalBps;
        for (uint256 i = 0; i < splitCount; i++) {
            if (splitAccounts[i] == address(0) || splitBps[i] == 0) {
                revert InvalidSplit();
            }

            totalBps += splitBps[i];
        }

        if (totalBps != BPS_DENOMINATOR) {
            revert InvalidBpsTotal();
        }

        if (splitAccounts[rightsHolderSplitIndex] != msg.sender) {
            revert InvalidRightsHolder();
        }

        tokenId = musicRightsNFT.mintTrack(msg.sender, metadataURI);

        _trackInfo[tokenId] = TrackInfo({
            title: title,
            ratePerPlayWei: ratePerPlayWei,
            totalPlays: 0,
            totalRoyaltyPaidWei: 0,
            rightsHolderSplitIndex: rightsHolderSplitIndex,
            exists: true
        });

        for (uint256 i = 0; i < splitCount; i++) {
            _trackSplits[tokenId].push(RoyaltySplit({account: splitAccounts[i], bps: splitBps[i]}));
        }

        emit TrackRegistered(tokenId, msg.sender, title, metadataURI, ratePerPlayWei);
    }

    function simulatePlays(uint256 tokenId, uint256 plays) external payable nonReentrant {
        if (plays == 0) {
            revert InvalidPlays();
        }

        TrackInfo storage track = _getTrackOrRevert(tokenId);
        RoyaltySplit[] storage splits = _trackSplits[tokenId];

        uint256 totalCost = plays * track.ratePerPlayWei;
        if (msg.value < totalCost) {
            revert InsufficientPayment(totalCost, msg.value);
        }

        uint256 rightsHolderIndex = track.rightsHolderSplitIndex;
        uint256 rightsHolderAmount = totalCost;

        for (uint256 i = 0; i < splits.length; i++) {
            if (i == rightsHolderIndex) {
                continue;
            }

            RoyaltySplit storage split = splits[i];
            uint256 amount = (totalCost * split.bps) / BPS_DENOMINATOR;
            rightsHolderAmount -= amount;

            _sendValue(split.account, amount);
            emit RoyaltySplitPaid(tokenId, split.account, amount, plays);
        }

        RoyaltySplit storage rightsHolderSplit = splits[rightsHolderIndex];
        _sendValue(rightsHolderSplit.account, rightsHolderAmount);
        emit RoyaltySplitPaid(tokenId, rightsHolderSplit.account, rightsHolderAmount, plays);

        track.totalPlays += plays;
        track.totalRoyaltyPaidWei += totalCost;

        if (msg.value > totalCost) {
            _sendValue(msg.sender, msg.value - totalCost);
        }

        emit RoyaltiesDistributed(tokenId, plays, totalCost, msg.sender);
    }

    function updateRightsHolderFromAuction(uint256 tokenId, address newRightsHolder) external {
        if (msg.sender != auctionContract) {
            revert NotAuction();
        }
        if (newRightsHolder == address(0)) {
            revert InvalidRightsHolder();
        }

        TrackInfo storage track = _getTrackOrRevert(tokenId);
        if (musicRightsNFT.ownerOf(tokenId) != newRightsHolder) {
            revert InvalidRightsHolder();
        }

        uint256 rightsHolderIndex = track.rightsHolderSplitIndex;
        _trackSplits[tokenId][rightsHolderIndex].account = newRightsHolder;

        emit RightsHolderUpdated(tokenId, newRightsHolder);
    }

    function getTrackInfo(uint256 tokenId) external view returns (TrackInfo memory) {
        TrackInfo memory info = _trackInfo[tokenId];
        if (!info.exists) {
            revert TrackNotFound();
        }

        return info;
    }

    function getTrackSplits(uint256 tokenId) external view returns (address[] memory accounts, uint96[] memory bps) {
        _getTrackOrRevert(tokenId);
        RoyaltySplit[] storage splits = _trackSplits[tokenId];

        uint256 splitCount = splits.length;
        accounts = new address[](splitCount);
        bps = new uint96[](splitCount);

        for (uint256 i = 0; i < splitCount; i++) {
            accounts[i] = splits[i].account;
            bps[i] = splits[i].bps;
        }
    }

    function rightsHolderOf(uint256 tokenId) public view returns (address) {
        TrackInfo storage track = _getTrackOrRevert(tokenId);
        return _trackSplits[tokenId][track.rightsHolderSplitIndex].account;
    }

    function quoteRoyaltyDistribution(uint256 tokenId, uint256 plays)
        external
        view
        returns (uint256 totalCost, address[] memory recipients, uint256[] memory amounts)
    {
        if (plays == 0) {
            revert InvalidPlays();
        }

        TrackInfo storage track = _getTrackOrRevert(tokenId);
        RoyaltySplit[] storage splits = _trackSplits[tokenId];

        totalCost = plays * track.ratePerPlayWei;
        recipients = new address[](splits.length);
        amounts = new uint256[](splits.length);

        uint256 rightsHolderIndex = track.rightsHolderSplitIndex;
        uint256 rightsHolderAmount = totalCost;

        for (uint256 i = 0; i < splits.length; i++) {
            recipients[i] = splits[i].account;

            if (i == rightsHolderIndex) {
                continue;
            }

            uint256 amount = (totalCost * splits[i].bps) / BPS_DENOMINATOR;
            amounts[i] = amount;
            rightsHolderAmount -= amount;
        }

        amounts[rightsHolderIndex] = rightsHolderAmount;
    }

    function _getTrackOrRevert(uint256 tokenId) internal view returns (TrackInfo storage track) {
        track = _trackInfo[tokenId];
        if (!track.exists) {
            revert TrackNotFound();
        }
    }

    function _sendValue(address recipient, uint256 amount) internal {
        if (amount == 0) {
            return;
        }

        (bool success, ) = payable(recipient).call{value: amount}("");
        if (!success) {
            revert TransferFailed(recipient, amount);
        }
    }
}
