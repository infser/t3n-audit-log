# T3N ADK Bounty Submission — Trusted Agent Audit Log

**Submitter**: infser  
**Bounty**: Create Agent ID, claim free tokens, & deploy first RUST contract on the network  
**Sponsor**: LOL ventures / Superteam Earn  
**Repository**: https://github.com/infser/t3n-audit-log  

---

## 1. Sign-up & API Key Claim ✅

I successfully signed up via SSO (Google) on the Terminal3 claim page and received:
- Agent ID (DID): `did:t3n:...` (automatically assigned)
- API key: `t3n_...` (copied securely, shown once)
- 20,000 test credits granted instantly

Screenshot: _[Attach screenshot of claim page with Agent ID]_

## 2. Quickstart — Connection to T3N Testnet ✅

I completed the Quickstart walkthrough using the TypeScript SDK:

```bash
mkdir t3n-audit-log && cd t3n-audit-log
npm init -y && npm pkg set type=module
npm install @terminal3/t3n-sdk tsx
export T3N_API_KEY="<my-key>"
npx tsx quickstart.ts
```

**Output**:
```
🔌 Loading WASM component...
🤝 Performing handshake...
🔐 Authenticating...
✅ Connected as: did:t3n:9f2a...
🎉 Quickstart complete! You're connected to T3N testnet.
```

The Quickstart script is in the repo at `quickstart/quickstart.ts`.

Screenshot: _[Attach screenshot of terminal showing "Connected as: did:t3n:..."]_

## 3. Walkthrough — Understanding the TEE Contract Model ✅

I thoroughly studied the `z-tenant-flight` reference contract structure:
- WIT world definition (world.wit + vendored host interfaces)
- `wit-bindgen` macro for binding generation
- `crate-type = ["cdylib", "lib"]` for WASM component + host testing
- GenericInput envelope pattern for contract functions
- KV store usage (z: namespace mapping)
- Tenant context (DID, cluster timestamp)
- Structured logging via host interfaces

## 4. First Rust Contract — Trusted Agent Audit Log ✅

I created a **custom** contract (`z-audit-log`, v0.1.0) — NOT a copy of the flight booking demo.

### What it does
Records tamper-proof audit events inside the T3N TEE. An AI agent calls `record-event` to log its actions and `list-events` to retrieve the audit trail.

### Exported Functions
| Function | Input | Output |
|---|---|---|
| `record-event` | `{event_type, metadata}` | `{id, timestamp, event_type}` |
| `list-events` | `{limit}` | `{events: [{id, timestamp, event_type, metadata}]}` |

### Architecture
```
contract/
├── Cargo.toml           # cdylib + lib, wit-bindgen 0.49
├── Cargo.lock
├── src/lib.rs           # wit-bindgen entry, Guest impl, unit tests
└── wit/
    ├── world.wit        # audit-log world with host imports
    └── deps/
        ├── host-interfaces-2.1.0/  # logging, kv-store
        └── host-tenant-1.0.0/      # tenant-context
```

### Validation
```
cargo test
  test tests::contract_version_is_semver ... ok
  test tests::contract_version_is_v0_1_0 ... ok
  test tests::generate_event_id_format ... ok
  3 passed, 0 failed

cargo build --target wasm32-wasip2 --release
  Finished release [optimized] target(s)
  -> target/wasm32-wasip2/release/z_audit_log.wasm (146KB)
```

Screenshots: _[Attach screenshots of test output and build output]_

## 5. Bug Report ✅

### Observation 1: Known WASM bundler issue
The T3N docs document a known issue where Next.js/Vite/Turbopack fail to load the WASM component. This is tracked in the docs and workaround (running from plain Node) is documented.

### Observation 2: `tenant_did()` return type
The `tenant_context::tenant_did()` function returns `list<u8>` (Vec<u8>), not a string. Developers must convert with `String::from_utf8()`. The reference code implicitly relies on this but it's easy to miss for newcomers.

## 6. Bonus: Real-World Use Case — Agent Accountability

### Problem
When an AI agent executes financial transactions on behalf of a user (e.g., "send 5 SOL to treasury"), there is no tamper-proof record. If funds go missing, it's the agent's word against the user's.

### Solution
Before executing any consequential action, the agent records an audit event via `z-audit-log`:

```json
{
  "event_type": "transaction_sent",
  "metadata": "{\"tx_id\":\"abc123\",\"amount\":\"5 SOL\",\"to\":\"treasury\"}"
}
```

The audit log is:
- **Tamper-proof**: stored in z: KV inside the TEE
- **Timestamped**: uses `cluster_timestamp_secs()` from tenant context
- **Append-only**: counter-based, no deletion
- **Verifiable**: auditors call `list-events` to retrieve

This is relevant for:
- **Compliance**: Prove what the agent did and when
- **Debugging**: Trace agent decision chains
- **Dispute resolution**: Cryptographic proof of agent actions
- **Multi-agent coordination**: Shared audit trail between agents

---

**All code and documentation available at**: https://github.com/infser/t3n-audit-log
