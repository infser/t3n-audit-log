/**
 * T3N ADK Quickstart — Connect, authenticate, and invoke the audit-log contract.
 *
 * Prerequisites:
 *   1. Claim API key at https://docs.terminal3.io/developers/adk/get-started/prerequisites/request-test-tokens
 *   2. npm install @terminal3/t3n-sdk tsx
 *   3. export T3N_API_KEY="<your key>"
 *
 * Usage:
 *   npx tsx quickstart.ts
 */

import {
  T3nClient,
  setEnvironment,
  loadWasmComponent,
  eth_get_address,
  metamask_sign,
  createEthAuthInput,
} from "@terminal3/t3n-sdk";

// ---------------------------------------------------------------------------
// Step 1: Connect to T3N testnet
// ---------------------------------------------------------------------------

setEnvironment("testnet");

const T3N_API_KEY = process.env.T3N_API_KEY!;
if (!T3N_API_KEY) {
  console.error("❌ T3N_API_KEY not set. Export it first:");
  console.error("   export T3N_API_KEY='<your key from the claim page>'");
  process.exit(1);
}

console.log("🔌 Loading WASM component...");
const wasmComponent = await loadWasmComponent();

const address = eth_get_address(T3N_API_KEY);

const t3n = new T3nClient({
  wasmComponent,
  handlers: {
    EthSign: metamask_sign(address, undefined, T3N_API_KEY),
  },
});

console.log("🤝 Performing handshake...");
await t3n.handshake();

console.log("🔐 Authenticating...");
const did = await t3n.authenticate(createEthAuthInput(address));
const tenantDid = did.value;

console.log("✅ Connected as:", tenantDid);
console.log("");

// ---------------------------------------------------------------------------
// Step 2: Print tenant info
// ---------------------------------------------------------------------------

console.log("📋 Tenant Information:");
console.log("   DID:", tenantDid);
console.log("   Address:", address);
console.log("");

console.log("🎉 Quickstart complete! You're connected to T3N testnet.");
console.log("");
console.log("Next steps:");
console.log("  1. Build the contract:  cd ../contract && cargo build --target wasm32-wasip2 --release");
console.log("  2. Register the contract via the tenant SDK");
console.log("  3. Invoke record-event and list-events");
