import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import type { DecentralizedAppStore } from "../typechain-types";

const SHA_DIGEST = ethers.zeroPadValue("0x1234", 32);
const OTHER_SHA_DIGEST = ethers.zeroPadValue("0x5678", 32);

describe("DecentralizedAppStore", function () {
  async function deployFixture() {
    const [owner, publisher, otherPublisher, aggregator, reviewer, reporter] =
      await ethers.getSigners();

    const Factory = await ethers.getContractFactory("DecentralizedAppStore");
    const store = (await Factory.deploy()) as unknown as DecentralizedAppStore;

    return { store, owner, publisher, otherPublisher, aggregator, reviewer, reporter };
  }

  describe("publishApp", function () {
    it("stores the app and its first version, and emits AppPublished", async function () {
      const { store, publisher } = await loadFixture(deployFixture);

      await expect(
        store
          .connect(publisher)
          .publishApp("CryptoChess", "A decentralized chess game", ["games"], "magnet:?xt=1", SHA_DIGEST)
      )
        .to.emit(store, "AppPublished")
        .withArgs(1, publisher.address, "CryptoChess", "magnet:?xt=1", SHA_DIGEST, anyValue);

      const app = await store.getApp(1);
      expect(app.publisher).to.equal(publisher.address);
      expect(app.name).to.equal("CryptoChess");
      expect(app.latestVersionId).to.equal(1);
      expect(app.latestReviewsHash).to.equal(ethers.ZeroHash);
      expect(app.latestReportsHash).to.equal(ethers.ZeroHash);

      const version = await store.getVersion(1, 1);
      expect(version.torrentRef).to.equal("magnet:?xt=1");
      expect(version.sha256Digest).to.equal(SHA_DIGEST);
    });

    it("rejects an empty app name", async function () {
      const { store, publisher } = await loadFixture(deployFixture);

      await expect(
        store.connect(publisher).publishApp("", "desc", [], "magnet:?xt=1", SHA_DIGEST)
      ).to.be.revertedWith("App name cannot be empty");
    });

    it("rejects publishing an app whose name is already taken", async function () {
      const { store, publisher, otherPublisher } = await loadFixture(deployFixture);
      await store.connect(publisher).publishApp("CryptoChess", "d", [], "magnet:1", SHA_DIGEST);

      await expect(
        store.connect(otherPublisher).publishApp("CryptoChess", "different desc", [], "magnet:2", OTHER_SHA_DIGEST)
      ).to.be.revertedWith("App name already taken");
    });

    it("increments appCount and assigns sequential ids across publishers", async function () {
      const { store, publisher, otherPublisher } = await loadFixture(deployFixture);

      await store.connect(publisher).publishApp("App1", "d", [], "magnet:1", SHA_DIGEST);
      await store.connect(otherPublisher).publishApp("App2", "d", [], "magnet:2", SHA_DIGEST);

      expect(await store.appCount()).to.equal(2);
      expect((await store.getApp(2)).publisher).to.equal(otherPublisher.address);
    });
  });

  describe("publishNewVersion", function () {
    it("allows only the original publisher to push a new version", async function () {
      const { store, publisher, otherPublisher } = await loadFixture(deployFixture);
      await store.connect(publisher).publishApp("App1", "d", [], "magnet:1", SHA_DIGEST);

      await expect(
        store.connect(otherPublisher).publishNewVersion(1, "magnet:2", OTHER_SHA_DIGEST)
      ).to.be.revertedWith("Not the app publisher");

      await expect(store.connect(publisher).publishNewVersion(1, "magnet:2", OTHER_SHA_DIGEST))
        .to.emit(store, "VersionPublished")
        .withArgs(1, 2, "magnet:2", OTHER_SHA_DIGEST, anyValue);

      const app = await store.getApp(1);
      expect(app.latestVersionId).to.equal(2);
      expect(await store.versionCounts(1)).to.equal(2);

      const version2 = await store.getVersion(1, 2);
      expect(version2.torrentRef).to.equal("magnet:2");
    });
  });

  describe("updateReviews", function () {
    it("defaults the aggregator to the deployer and lets it anchor a new reviews hash", async function () {
      const { store, owner, publisher } = await loadFixture(deployFixture);
      await store.connect(publisher).publishApp("App1", "d", [], "magnet:1", SHA_DIGEST);

      const newHash = ethers.keccak256(ethers.toUtf8Bytes("reviews-v1"));

      await expect(store.connect(owner).updateReviews(1, newHash, "magnet:reviews-1"))
        .to.emit(store, "ReviewsAggregated")
        .withArgs(1, ethers.ZeroHash, newHash, "magnet:reviews-1", anyValue);

      expect((await store.getApp(1)).latestReviewsHash).to.equal(newHash);
    });

    it("rejects calls from anyone other than the current aggregator", async function () {
      const { store, publisher, reviewer } = await loadFixture(deployFixture);
      await store.connect(publisher).publishApp("App1", "d", [], "magnet:1", SHA_DIGEST);

      await expect(
        store.connect(reviewer).updateReviews(1, ethers.ZeroHash, "magnet:reviews-1")
      ).to.be.revertedWith("Not the authorized aggregator");
    });

    it("rejects updates for a non-existent app", async function () {
      const { store, owner } = await loadFixture(deployFixture);

      await expect(
        store.connect(owner).updateReviews(999, ethers.ZeroHash, "magnet:reviews-1")
      ).to.be.revertedWith("App does not exist");
    });

    it("lets the owner rotate the aggregator to the cache server's wallet", async function () {
      const { store, owner, publisher, aggregator } = await loadFixture(deployFixture);
      await store.connect(publisher).publishApp("App1", "d", [], "magnet:1", SHA_DIGEST);

      await expect(store.connect(owner).setAggregator(aggregator.address))
        .to.emit(store, "AggregatorChanged")
        .withArgs(owner.address, aggregator.address);

      await expect(
        store.connect(owner).updateReviews(1, ethers.ZeroHash, "magnet:reviews-1")
      ).to.be.revertedWith("Not the authorized aggregator");

      await expect(store.connect(aggregator).updateReviews(1, ethers.ZeroHash, "magnet:reviews-1"))
        .to.not.be.reverted;
    });

    it("rejects non-owners rotating the aggregator", async function () {
      const { store, reviewer, aggregator } = await loadFixture(deployFixture);

      await expect(
        store.connect(reviewer).setAggregator(aggregator.address)
      ).to.be.revertedWith("Not the contract owner");
    });
  });

  // updateReports mirrors updateReviews exactly - reports, like reviews, are aggregated
  // off-chain and only anchored on-chain as a hash (see web-ui/src/lib/reports-aggregator.ts).
  describe("updateReports", function () {
    it("defaults the aggregator to the deployer and lets it anchor a new reports hash", async function () {
      const { store, owner, publisher } = await loadFixture(deployFixture);
      await store.connect(publisher).publishApp("App1", "d", [], "magnet:1", SHA_DIGEST);

      const newHash = ethers.keccak256(ethers.toUtf8Bytes("reports-v1"));

      await expect(store.connect(owner).updateReports(1, newHash, "magnet:reports-1"))
        .to.emit(store, "ReportsAggregated")
        .withArgs(1, ethers.ZeroHash, newHash, "magnet:reports-1", anyValue);

      expect((await store.getApp(1)).latestReportsHash).to.equal(newHash);
    });

    it("rejects calls from anyone other than the current aggregator", async function () {
      const { store, publisher, reviewer } = await loadFixture(deployFixture);
      await store.connect(publisher).publishApp("App1", "d", [], "magnet:1", SHA_DIGEST);

      await expect(
        store.connect(reviewer).updateReports(1, ethers.ZeroHash, "magnet:reports-1")
      ).to.be.revertedWith("Not the authorized aggregator");
    });

    it("rejects updates for a non-existent app", async function () {
      const { store, owner } = await loadFixture(deployFixture);

      await expect(
        store.connect(owner).updateReports(999, ethers.ZeroHash, "magnet:reports-1")
      ).to.be.revertedWith("App does not exist");
    });

    it("does not affect latestReviewsHash - the two hash anchors are independent", async function () {
      const { store, owner, publisher } = await loadFixture(deployFixture);
      await store.connect(publisher).publishApp("App1", "d", [], "magnet:1", SHA_DIGEST);

      const reviewsHash = ethers.keccak256(ethers.toUtf8Bytes("reviews-v1"));
      const reportsHash = ethers.keccak256(ethers.toUtf8Bytes("reports-v1"));

      await store.connect(owner).updateReviews(1, reviewsHash, "magnet:reviews-1");
      await store.connect(owner).updateReports(1, reportsHash, "magnet:reports-1");

      const app = await store.getApp(1);
      expect(app.latestReviewsHash).to.equal(reviewsHash);
      expect(app.latestReportsHash).to.equal(reportsHash);
    });
  });

  describe("updateMerkleRoot", function () {
    it("lets the aggregator anchor a new root and emits MerkleRootUpdated", async function () {
      const { store, owner } = await loadFixture(deployFixture);
      const newRoot = ethers.keccak256(ethers.toUtf8Bytes("root-v1"));

      await expect(store.connect(owner).updateMerkleRoot(newRoot))
        .to.emit(store, "MerkleRootUpdated")
        .withArgs(ethers.ZeroHash, newRoot, anyValue);

      expect(await store.merkleRoot()).to.equal(newRoot);
    });

    it("rejects calls from anyone other than the current aggregator", async function () {
      const { store, reviewer } = await loadFixture(deployFixture);
      const newRoot = ethers.keccak256(ethers.toUtf8Bytes("root-v1"));

      await expect(store.connect(reviewer).updateMerkleRoot(newRoot)).to.be.revertedWith(
        "Not the authorized aggregator"
      );
    });
  });

  describe("reportApp", function () {
    it("increments the report count and emits AppReported", async function () {
      const { store, publisher, reporter } = await loadFixture(deployFixture);
      await store.connect(publisher).publishApp("App1", "d", [], "magnet:1", SHA_DIGEST);

      await expect(store.connect(reporter).reportApp(1, "Contains malware"))
        .to.emit(store, "AppReported")
        .withArgs(1, reporter.address, "Contains malware", 1, anyValue);

      expect(await store.reportCount(1)).to.equal(1);
    });

    it("prevents the same address from reporting an app twice", async function () {
      const { store, publisher, reporter } = await loadFixture(deployFixture);
      await store.connect(publisher).publishApp("App1", "d", [], "magnet:1", SHA_DIGEST);

      await store.connect(reporter).reportApp(1, "Spam");
      await expect(store.connect(reporter).reportApp(1, "Spam again")).to.be.revertedWith(
        "You already reported this app"
      );
    });

    it("rejects reporting a non-existent app", async function () {
      const { store, reporter } = await loadFixture(deployFixture);

      await expect(store.connect(reporter).reportApp(999, "Spam")).to.be.revertedWith(
        "App does not exist"
      );
    });
  });
});
