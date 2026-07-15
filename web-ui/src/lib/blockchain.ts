import { ethers } from "ethers";
import contractData from "../constants/DecentralizedAppStore.json";

/**
 * Initializes and returns a contract instance connected to the local Hardhat node
 */
export function getBlockchainContract() {
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

  if (!rpcUrl || !contractAddress) {
    throw new Error("Missing blockchain environment configuration");
  }

  // Create a provider pointing to the local node running in your terminal
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // Initialize the contract object using address, ABI, and provider
  const contract = new ethers.Contract(
    contractAddress,
    contractData.abi,
    provider
  );

  return contract;
}

// Hardhat Network's fixed chain id (31337 / 0x7a69). Every signing action needs MetaMask
// actually pointed at this local chain first - otherwise "publish"/"report"/"review" silently
// try to sign against whatever network MetaMask currently has selected (e.g. real Sepolia or
// mainnet), which fails on a real balance check or, worse, asks the user to spend real ETH.
// This used to only run inside the upload form right before publishing; every other
// wallet-signing action skipped it entirely.
export async function switchToLocalNetwork(): Promise<void> {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed");
  }

  // Every wallet-signing action calls this, so skip the wallet_switchEthereumChain round
  // trip entirely when we're already on the right chain - otherwise every single button
  // that signs (report/publish/upload) pays a real MetaMask RPC round trip for a no-op.
  const currentChainId = await window.ethereum.request({ method: "eth_chainId" });
  if (currentChainId === "0x7a69") return;

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x7a69" }],
    });
  } catch (switchError: any) {
    // 4902 = chain hasn't been added to this wallet yet - add it, then MetaMask switches to it.
    if (switchError.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0x7a69",
            chainName: "Hardhat Local (Test - Fake Funds)",
            rpcUrls: ["http://127.0.0.1:8545"],
            // Deliberately NOT "ETH": MetaMask fetches/shows a real-world fiat estimate for
            // any network using that symbol, which reads as "this costs real money" even
            // though this chain's balances are entirely local and fake. An unrecognized
            // symbol like this one has no priced asset to look up, so no fiat estimate shows.
            nativeCurrency: { name: "Test Ether", symbol: "tETH", decimals: 18 },
          },
        ],
      });
    } else {
      throw switchError;
    }
  }
}

/** Prompts MetaMask for account access and returns the connected address. */
export async function connectWallet(): Promise<string> {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask is not installed. Please install it to interact with the blockchain.");
  }
  await switchToLocalNetwork();
  const provider = new ethers.BrowserProvider(window.ethereum);
  const accounts = await provider.send("eth_requestAccounts", []);
  return accounts[0];
}

/**
 * Returns the already-authorized account, if any, without prompting MetaMask - unlike
 * connectWallet()/eth_requestAccounts, eth_accounts never pops up a permission dialog. Without
 * this, a site the user already approved in a previous session looks wallet-disconnected (and
 * gates wallet-only features like uploading) until they click "Connect Wallet" again every visit.
 */
export async function getAlreadyConnectedAccount(): Promise<string | null> {
  if (typeof window === "undefined" || !window.ethereum) return null;
  const provider = new ethers.BrowserProvider(window.ethereum);
  const accounts = await provider.send("eth_accounts", []);
  return accounts[0] ?? null;
}

export async function getEthereumContractWithSigner() {
  // Check if MetaMask (window.ethereum) is injected into the browser
  if (typeof window !== "undefined" && window.ethereum) {
    // 1. Make sure we're signing against the local chain, not whatever network the wallet
    // happens to be on - the user may have switched networks after connecting, so this can't
    // only happen once at connect-time.
    await switchToLocalNetwork();

    // 2. Initialize BrowserProvider using the MetaMask object
    const provider = new ethers.BrowserProvider(window.ethereum);

    // 3. Request account access from the user and retrieve the Signer (the current active wallet)
    const signer = await provider.getSigner();

    // 4. Fetch the contract address from environment variables
    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
    if (!contractAddress) throw new Error("Missing contract address configuration");

    // 5. Return the contract instance mapped directly to the active signer
    return new ethers.Contract(contractAddress, contractData.abi, signer);
  } else {
    throw new Error("MetaMask is not installed. Please install it to interact with the blockchain.");
  }
}