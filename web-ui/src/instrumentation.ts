// Next.js calls register() exactly once when the server process boots (both `next dev` and
// `next start`). This is what actually starts Module B's BlockchainListener server-side -
// previously the only place events were ever read was a one-shot client-side query on page
// load, which synced nothing to a shared cache.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startBlockchainListener } = await import("./lib/blockchain-listener");
    startBlockchainListener();
  }
}
