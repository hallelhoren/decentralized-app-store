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

export async function getEthereumContractWithSigner() {
  // Check if MetaMask (window.ethereum) is injected into the browser
  if (typeof window !== "undefined" && (window as any).ethereum) {
    // 1. Initialize BrowserProvider using the MetaMask object
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    
    // 2. Request account access from the user and retrieve the Signer (the current active wallet)
    const signer = await provider.getSigner();
    
    // 3. Fetch the contract address from environment variables
    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
    if (!contractAddress) throw new Error("Missing contract address configuration");

    // 4. Return the contract instance mapped directly to the active signer
    return new ethers.Contract(contractAddress, contractData.abi, signer);
  } else {
    throw new Error("MetaMask is not installed. Please install it to interact with the blockchain.");
  }
}