export {};

// MetaMask (and other EIP-1193 wallets) inject this global - there's no first-party type
// package for it, and the previous code worked around the missing type ad hoc with
// `as any` casts scattered across lib/blockchain.ts. Declaring it once here means
// `window.ethereum` type-checks everywhere without those casts.
declare global {
  interface Window {
    // Loosely typed on purpose: ethers.BrowserProvider/request() argument shapes vary by
    // wallet, and this file only needs to stop "Property 'ethereum' does not exist" errors,
    // not fully model EIP-1193.
    ethereum?: any;
  }
}
