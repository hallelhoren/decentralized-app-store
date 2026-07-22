import { ethers } from "ethers";
import contractData from "../constants/DecentralizedAppStore.json";

// Hardhat's well-known deterministic dev account #1 (mnemonic "test test test ... junk"),
// used only as a zero-config default so a fresh local checkout can demo the full
// aggregation -> on-chain-anchor loop without any manual setup. Anything other than a local
// Hardhat/Ganache chain MUST set AGGREGATOR_PRIVATE_KEY to a real, funded key and call
// setAggregator() on-chain to match - this default is not safe to reuse anywhere public.
const DEV_ONLY_AGGREGATOR_KEY =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

/**
 * Server-side contract instance signed by the cache server's own aggregator wallet - the one
 * identity the contract trusts to anchor updateReviews/updateMerkleRoot. Shared by
 * reviews-aggregator.ts and merkle.ts so both call sites use the same key resolution instead
 * of duplicating it.
 */
export function getAggregatorContract(): ethers.Contract {
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  if (!rpcUrl || !contractAddress) {
    throw new Error("Missing NEXT_PUBLIC_RPC_URL / NEXT_PUBLIC_CONTRACT_ADDRESS");
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(process.env.AGGREGATOR_PRIVATE_KEY || DEV_ONLY_AGGREGATOR_KEY, provider);
  return new ethers.Contract(contractAddress, contractData.abi, wallet);
}
