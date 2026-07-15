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
        bytes32 latestReviewsHash; // Anchor point for aggregated P2P reviews
    }

    // State Variables
    uint256 public appCount;
    mapping(uint256 => App) public apps;
    mapping(uint256 => mapping(uint256 => Version)) public appVersions;
    mapping(uint256 => uint256) public versionCounts;

    // The address allowed to anchor aggregated review hashes (see updateReviews). This is the
    // Next.js cache server's own on-chain identity, per the team's design: the cache server is
    // untrusted for search/browse correctness (clients can always fall back to raw chain reads),
    // but review aggregation specifically requires *a* known signer so that `apps[id]` cannot be
    // overwritten by an arbitrary address. The owner can rotate this if the server's key changes.
    address public owner;
    address public aggregator;

    // Simple crowd-sourced malicious-app flagging. Deliberately does not remove or hide
    // anything on its own - apps/reviews stay censorship-resistant/immutable; this only records
    // a public signal (report count + reasons) that a client UI or off-chain moderation process
    // can act on.
    mapping(uint256 => uint256) public reportCount;
    mapping(uint256 => mapping(address => bool)) public hasReported;

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

    event ReviewsAggregated(
        uint256 indexed appId,
        bytes32 oldReviewsHash,
        bytes32 newReviewsHash,
        string torrentRef, // Location of the new aggregated dataset in the P2P network
        uint256 timestamp
    );

    event AppReported(
        uint256 indexed appId,
        address indexed reporter,
        string reason,
        uint256 newReportCount,
        uint256 timestamp
    );

    event AggregatorChanged(address indexed previousAggregator, address indexed newAggregator);

    // Modifiers
    modifier onlyPublisher(uint256 _appId) {
        require(apps[_appId].publisher == msg.sender, "Not the app publisher");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not the contract owner");
        _;
    }

    modifier onlyAggregator() {
        require(msg.sender == aggregator, "Not the authorized aggregator");
        _;
    }

    modifier validApp(uint256 _appId) {
        require(_appId > 0 && _appId <= appCount, "App does not exist");
        _;
    }

    constructor() {
        // The deployer is the initial aggregator too, so a local/demo deployment works without
        // extra setup; call setAggregator to point it at the cache server's dedicated wallet.
        owner = msg.sender;
        aggregator = msg.sender;
    }

    function setAggregator(address _newAggregator) external onlyOwner {
        require(_newAggregator != address(0), "Aggregator cannot be the zero address");
        emit AggregatorChanged(aggregator, _newAggregator);
        aggregator = _newAggregator;
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
            latestVersionId: 1, // Fixed: Added missing comma
            latestReviewsHash: bytes32(0)
        });
        
        appVersions[newAppId][1] = Version({
            versionId: 1,
            torrentRef: _torrentRef,
            sha256Digest: _shaDigest,
            timestamp: block.timestamp
        });
        
        versionCounts[newAppId] = 1;
        
        emit AppPublished(newAppId, msg.sender, _name, _torrentRef, _shaDigest, block.timestamp);
    }

    /**
     * @notice Updates the cryptographic review pointer using the advisor's aggregation model.
     * @param _appId The target application ID.
     * @param _newReviewsHash The recomputed hash representing the old state + new reviews chunk.
     * @param _torrentRef The BitTorrent magnet link where the updated reviews file is seeded.
     */
    function updateReviews(
        uint256 _appId,
        bytes32 _newReviewsHash,
        string calldata _torrentRef
    ) external onlyAggregator validApp(_appId) {
        bytes32 oldHash = apps[_appId].latestReviewsHash;
        apps[_appId].latestReviewsHash = _newReviewsHash;

        emit ReviewsAggregated(_appId, oldHash, _newReviewsHash, _torrentRef, block.timestamp);
    }

    /**
     * @notice Flags an app as potentially malicious/censorable-worthy. Purely additive - it
     * cannot delete or hide the app or its reviews, keeping the store censorship-resistant;
     * it just gives clients and off-chain moderation tooling a public signal to act on.
     */
    function reportApp(uint256 _appId, string calldata _reason) external validApp(_appId) {
        require(!hasReported[_appId][msg.sender], "You already reported this app");

        hasReported[_appId][msg.sender] = true;
        reportCount[_appId]++;

        emit AppReported(_appId, msg.sender, _reason, reportCount[_appId], block.timestamp);
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
            sha256Digest: _shaDigest,
            timestamp: block.timestamp
        });
        
        apps[_appId].latestVersionId = newVersionId;
        
        emit VersionPublished(_appId, newVersionId, _torrentRef, _shaDigest, block.timestamp);
    }

    // View Functions for Direct Blockchain Fallback Queries
    function getApp(uint256 _appId) external view returns (App memory) {
        return apps[_appId];
    }

    function getVersion(uint256 _appId, uint256 _versionId) external view returns (Version memory) {
        return appVersions[_appId][_versionId];
    }
}