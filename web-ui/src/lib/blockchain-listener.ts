import { ethers } from "ethers";
import { prisma } from "./db";
import contractData from "../constants/DecentralizedAppStore.json";
import { buildAppTree, getRoot } from "./merkle";
import { getAggregatorContract } from "./aggregator-wallet";

const POLL_INTERVAL_MS = 4000;
// Public RPC providers (Sepolia/Infura/Alchemy free tiers) commonly cap how many blocks a
// single getLogs call may span - chunk the backfill so this also works past local Hardhat.
const MAX_BLOCK_RANGE = 2000;

let started = false;

/**
 * Module B from the HLD ("Indexer and Sync Module"): mirrors on-chain App/Version/Review-hash
 * state into Postgres so search/browse/details never need a live chain call. Uses polling
 * (getLogs over block ranges) rather than a WS subscription, per the HLD's own fallback plan
 * ("if Web3 event subscriptions are unreliable, use periodic block polling instead") - this
 * also means it works unchanged against a plain HTTP RPC endpoint on a public testnet.
 */
export class BlockchainListener {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;
  private timer: ReturnType<typeof setInterval> | null = null;
  private syncing = false;

  constructor(rpcUrl: string, contractAddress: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.contract = new ethers.Contract(contractAddress, contractData.abi, this.provider);
  }

  async start() {
    await this.syncOnce().catch((err) => console.error("[BlockchainListener] initial sync failed:", err));
    this.timer = setInterval(() => {
      if (this.syncing) return;
      this.syncing = true;
      this.syncOnce()
        .catch((err) => console.error("[BlockchainListener] sync failed:", err))
        .finally(() => {
          this.syncing = false;
        });
    }, POLL_INTERVAL_MS);
    console.log("[BlockchainListener] started, polling every", POLL_INTERVAL_MS, "ms");
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  private async getLastBlock(): Promise<number> {
    const state = await prisma.syncState.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, lastBlock: 0 },
    });
    return state.lastBlock;
  }

  private async setLastBlock(block: number) {
    await prisma.syncState.update({ where: { id: 1 }, data: { lastBlock: block } });
  }

  private async forEachRange(
    fromBlock: number,
    toBlock: number,
    handler: (from: number, to: number) => Promise<void>
  ) {
    for (let start = fromBlock; start <= toBlock; start += MAX_BLOCK_RANGE + 1) {
      const end = Math.min(start + MAX_BLOCK_RANGE, toBlock);
      await handler(start, end);
    }
  }

  async syncOnce() {
    const latestBlock = await this.provider.getBlockNumber();
    let lastBlock = await this.getLastBlock();

    // A real chain's height only ever increases, but a local Hardhat node resets to near-zero
    // every time it's restarted. Without this, a restart leaves our cursor permanently ahead
    // of the (now much shorter) chain, and syncOnce silently no-ops forever - nothing new ever
    // gets indexed again until the chain organically grows past the stale cursor.
    if (latestBlock < lastBlock) {
      console.warn(
        `[BlockchainListener] chain height (${latestBlock}) is behind our cursor (${lastBlock}) - the node looks like it was reset; wiping the local mirror and resyncing from block 0`
      );
      // A reset chain's fresh contract deployment reassigns appId/versionId from scratch (its
      // own appCount starts back at 0) - those numbers now refer to whatever unrelated apps get
      // published on the new chain, not the old ones. Without clearing these tables first,
      // replaying AppPublished(appId=1, ...) for a brand-new app would upsert straight onto the
      // *old* app 1's row, silently overwriting its name/publisher/description. There's nothing
      // worth reconciling from the old chain incarnation - it no longer exists - so start the
      // mirror genuinely empty rather than leaving stale rows for new IDs to collide with.
      await prisma.$transaction([prisma.review.deleteMany(), prisma.version.deleteMany(), prisma.app.deleteMany()]);
      lastBlock = 0;
      await this.setLastBlock(0);
    }

    if (latestBlock <= lastBlock) return;

    const fromBlock = lastBlock + 1;

    // Process in dependency order: AppPublished creates the App row that VersionPublished /
    // ReviewsAggregated / AppReported updates depend on (the contract itself enforces that
    // those calls can't target a non-existent appId, so this ordering is always safe).
    await this.forEachRange(fromBlock, latestBlock, (from, to) => this.syncAppPublished(from, to));
    await this.forEachRange(fromBlock, latestBlock, (from, to) => this.syncVersionPublished(from, to));
    await this.forEachRange(fromBlock, latestBlock, (from, to) => this.syncReviewsAggregated(from, to));
    await this.forEachRange(fromBlock, latestBlock, (from, to) => this.syncAppReported(from, to));

    await this.setLastBlock(latestBlock);

    // Best-effort: a failed anchor just leaves the on-chain root stale until the next sync
    // tick retries with the same (still-current) tree, rather than failing the whole sync.
    await this.syncMerkleRoot().catch((err) =>
      console.error("[BlockchainListener] failed to sync Merkle root:", err)
    );
  }

  /**
   * Rebuilds the Merkle tree over the current app listing and, if it changed since the last
   * anchor, submits the new root on-chain - this is what lets a client verify the cache
   * server's data against a value it read directly from the chain (see updateMerkleRoot in
   * DappStore.sol and src/lib/merkle.ts).
   */
  private async syncMerkleRoot() {
    const apps = await prisma.app.findMany({ include: { versions: true } });
    const { layers } = buildAppTree(apps);
    const newRoot = getRoot(layers);

    const currentRoot: string = await this.contract.merkleRoot();
    if (currentRoot.toLowerCase() === newRoot.toLowerCase()) return;

    const aggregatorContract = getAggregatorContract();
    const tx = await aggregatorContract.updateMerkleRoot(newRoot);
    await tx.wait();
    console.log(`[BlockchainListener] anchored new Merkle root over ${apps.length} apps: ${newRoot}`);
  }

  private async syncAppPublished(fromBlock: number, toBlock: number) {
    const logs = await this.contract.queryFilter(
      this.contract.filters.AppPublished(),
      fromBlock,
      toBlock
    );

    for (const log of logs) {
      const event = log as ethers.EventLog;
      const appId = Number(event.args.appId);

      // The event itself doesn't carry description/tags - fall back to a direct read call
      // (matches the HLD class diagram's "RPC Read Calls" arrow from the cache server).
      const onChainApp = await this.contract.getApp(appId);
      const block = await log.getBlock();

      await prisma.app.upsert({
        where: { id: appId },
        create: {
          id: appId,
          publisher: onChainApp.publisher,
          name: onChainApp.name,
          description: onChainApp.description,
          tags: [...onChainApp.tags],
          latestVersionId: Number(onChainApp.latestVersionId),
          latestReviewsHash: onChainApp.latestReviewsHash,
          publishedAt: new Date(block.timestamp * 1000),
        },
        update: {
          publisher: onChainApp.publisher,
          name: onChainApp.name,
          description: onChainApp.description,
          tags: [...onChainApp.tags],
        },
      });

      await prisma.version.upsert({
        where: { appId_versionId: { appId, versionId: 1 } },
        create: {
          appId,
          versionId: 1,
          torrentRef: event.args.torrentRef,
          sha256Digest: event.args.shaDigest,
          publishedAt: new Date(Number(event.args.timestamp) * 1000),
        },
        update: {},
      });

      console.log(`[BlockchainListener] indexed AppPublished appId=${appId}`);
    }
  }

  private async syncVersionPublished(fromBlock: number, toBlock: number) {
    const logs = await this.contract.queryFilter(
      this.contract.filters.VersionPublished(),
      fromBlock,
      toBlock
    );

    for (const log of logs) {
      const event = log as ethers.EventLog;
      const appId = Number(event.args.appId);
      const versionId = Number(event.args.versionId);

      await prisma.version.upsert({
        where: { appId_versionId: { appId, versionId } },
        create: {
          appId,
          versionId,
          torrentRef: event.args.torrentRef,
          sha256Digest: event.args.shaDigest,
          publishedAt: new Date(Number(event.args.timestamp) * 1000),
        },
        update: {
          torrentRef: event.args.torrentRef,
          sha256Digest: event.args.shaDigest,
        },
      });

      await prisma.app.update({
        where: { id: appId },
        data: { latestVersionId: versionId },
      });

      console.log(`[BlockchainListener] indexed VersionPublished appId=${appId} versionId=${versionId}`);
    }
  }

  private async syncReviewsAggregated(fromBlock: number, toBlock: number) {
    const logs = await this.contract.queryFilter(
      this.contract.filters.ReviewsAggregated(),
      fromBlock,
      toBlock
    );

    for (const log of logs) {
      const event = log as ethers.EventLog;
      const appId = Number(event.args.appId);

      await prisma.app.update({
        where: { id: appId },
        data: {
          latestReviewsHash: event.args.newReviewsHash,
          latestReviewsRef: event.args.torrentRef,
        },
      });

      console.log(`[BlockchainListener] indexed ReviewsAggregated appId=${appId}`);
    }
  }

  private async syncAppReported(fromBlock: number, toBlock: number) {
    const logs = await this.contract.queryFilter(
      this.contract.filters.AppReported(),
      fromBlock,
      toBlock
    );

    for (const log of logs) {
      const event = log as ethers.EventLog;
      const appId = Number(event.args.appId);

      await prisma.app.update({
        where: { id: appId },
        data: { reportCount: Number(event.args.newReportCount) },
      });

      console.log(`[BlockchainListener] indexed AppReported appId=${appId}`);
    }
  }
}

/** Starts the singleton listener once per server process (see src/instrumentation.ts). */
export function startBlockchainListener() {
  if (started) return;
  started = true;

  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

  if (!rpcUrl || !contractAddress) {
    console.warn(
      "[BlockchainListener] NEXT_PUBLIC_RPC_URL / NEXT_PUBLIC_CONTRACT_ADDRESS not set - skipping sync"
    );
    started = false;
    return;
  }

  const listener = new BlockchainListener(rpcUrl, contractAddress);
  listener.start().catch((err) => {
    console.error("[BlockchainListener] failed to start:", err);
    started = false;
  });
}
