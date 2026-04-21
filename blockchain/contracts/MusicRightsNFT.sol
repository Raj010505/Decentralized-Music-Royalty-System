// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

contract MusicRightsNFT is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;
    address public royaltyManager;

    error NotRoyaltyManager();
    error ZeroAddress();

    event RoyaltyManagerUpdated(address indexed oldManager, address indexed newManager);
    event TrackMinted(uint256 indexed tokenId, address indexed owner, string tokenURI);

    constructor() ERC721("Music Rights NFT", "MRIGHTS") Ownable(msg.sender) {}

    modifier onlyRoyaltyManager() {
        if (msg.sender != royaltyManager) {
            revert NotRoyaltyManager();
        }
        _;
    }

    function setRoyaltyManager(address manager) external onlyOwner {
        if (manager == address(0)) {
            revert ZeroAddress();
        }

        address previousManager = royaltyManager;
        royaltyManager = manager;

        emit RoyaltyManagerUpdated(previousManager, manager);
    }

    function mintTrack(address to, string calldata metadataURI) external onlyRoyaltyManager returns (uint256 tokenId) {
        if (to == address(0)) {
            revert ZeroAddress();
        }

        tokenId = ++_nextTokenId;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, metadataURI);

        emit TrackMinted(tokenId, to, metadataURI);
    }

    function nextTokenId() external view returns (uint256) {
        return _nextTokenId + 1;
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
