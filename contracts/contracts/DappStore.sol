// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract DecentralizedAppStore {

    struct Version {
        uint256 versionId;
        string torrentRef;      // Torrent reference string or infohash
        bytes32 sha256Digest;   // Cryptographic hash for binary integrity
        uint256 timestamp;
    }

    struct App {
        uint256 appId;
        address publisher;
        string name;
        string description;
        string[] tags;
        uint256 latestVersionId;
    }

    struct Review {
        address reviewer;
        uint8 rating;           // Rating value (e.g., 1 to 5)
        string reviewText;      // Review text content
        uint256 timestamp;
    }

    // State Variables
    uint256 public appCount;
    mapping(uint256 => App) public apps;
    mapping(uint256 => mapping(uint256 => Version)) public appVersions;
    mapping(uint256 => uint256) public versionCounts;
    mapping(uint256 => Review[]) public appReviews;

    // Events for Indexer and Sync Module (Next.js Cache Server)
    event AppPublished(
        uint256 indexed appId, 
        address indexed publisher, 
        string name, 
        string torrentRef, 
        bytes32 shaDigest, 
        uint256 timestamp
    );
    
    event VersionPublished(
        uint256 indexed appId, 
        uint256 indexed versionId, 
        string torrentRef, 
        bytes32 shaDigest, 
        uint256 timestamp
    );
    
    event ReviewSubmitted(
        uint256 indexed appId, 
        address indexed reviewer, 
        uint8 rating, 
        string reviewText, 
        uint256 timestamp
    );

    // Modifiers
    modifier onlyPublisher(uint256 _appId) {
        require(apps[_appId].publisher == msg.sender, "Not the app publisher");
        _;
    }

    // Core Functions
    function publishApp(
        string calldata _name,
        string calldata _description,
        string[] calldata _tags,
        string calldata _torrentRef,
        bytes32 _shaDigest
    ) external {
        require(bytes(_name).length > 0, "App name cannot be empty");
        
        appCount++;
        uint256 newAppId = appCount;
        
        apps[newAppId] = App({
            appId: newAppId,
            publisher: msg.sender,
            name: _name,
            description: _description,
            tags: _tags,
            latestVersionId: 1
        });
        
        appVersions[newAppId][1] = Version({
            versionId: 1,
            torrentRef: _torrentRef,
            bytes32sha256Digest: _shaDigest,
            timestamp: block.timestamp
        });
        
        versionCounts[newAppId] = 1;
        
        emit AppPublished(newAppId, msg.sender, _name, _torrentRef, _shaDigest, block.timestamp);
    }

    function publishNewVersion(
        uint256 _appId,
        string calldata _torrentRef,
        bytes32 _shaDigest
    ) external onlyPublisher(_appId) {
        versionCounts[_appId]++;
        uint256 newVersionId = versionCounts[_appId];
        
        appVersions[_appId][newVersionId] = Version({
            versionId: newVersionId,
            torrentRef: _torrentRef,
            bytes32sha256Digest: _shaDigest,
            timestamp: block.timestamp
        });
        
        apps[_appId].latestVersionId = newVersionId;
        
        emit VersionPublished(_appId, newVersionId, _torrentRef, _shaDigest, block.timestamp);
    }

    function addReview(
        uint256 _appId,
        uint8 _rating,
        string calldata _reviewText
    ) external {
        require(_appId > 0 && _appId <= appCount, "App does not exist");
        require(_rating >= 1 && _rating <= 5, "Rating must be between 1 and 5");
        
        Review memory newReview = Review({
            reviewer: msg.sender,
            rating: _rating,
            reviewText: _reviewText,
            timestamp: block.timestamp
        });
        
        appReviews[_appId].push(newReview);
        
        emit ReviewSubmitted(_appId, msg.sender, _rating, _reviewText, block.timestamp);
    }

    // View Functions for Direct Blockchain Fallback Queries
    function getApp(uint256 _appId) external view returns (App memory) {
        return apps[_appId];
    }

    function getVersion(uint256 _appId, uint256 _versionId) external view returns (Version memory) {
        return appVersions[_appId][_versionId];
    }

    function getReviews(uint256 _appId) external view returns (Review[] memory) {
        return appReviews[_appId];
    }
}