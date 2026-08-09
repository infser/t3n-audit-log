# T3N ADK Bounty Submission — Trusted Agent Audit Log

**Superteam Earn**: [Create Agent ID, claim free tokens, & deploy first RUST contract on the network](https://superteam.fun/earn/listing/ai-id)  
**Bounty by**: LOL ventures  
**Prize**: 200 USDC (6 winners)  
**Submitted by**: infser

---

## Overview

This submission completes all requirements of the LOL ventures T3N ADK bounty:

1. ✅ **Sign up via SSO** — claimed Agent ID and API key
2. ✅ **Quickstart** — connected to T3N testnet via TypeScript SDK
3. ✅ **Walkthrough** — understood the TEE contract model
4. ✅ **Deploy first Rust contract** — custom `z-audit-log` contract
5. ✅ **Bug report** — documented findings
6. ✅ **Bonus use case** — Agent Accountability via Trusted Audit Log

## Quickstart

The quickstart TypeScript script connects to T3N testnet and authenticates:

```bash
cd quickstart
npm install
export T3N_API_KEY="<your-key>"
npx tsx quickstart.ts
```

**Output**:
```
🔌 Loading WASM component...
🤝 Performing handshake...
🔐 Authenticating...
✅ Connected as: did:t3n:...
🎉 Quickstart complete! You're connected to T3N testnet.
```

## Contract: z-audit-log

A custom Rust TEE contract compiled to WASM component (wasm32-wasip2).

### What it does

Records tamper-proof audit events inside the T3N TEE. AI agents call
`record-event` to log their actions and `list-events` to retrieve the
audit trail.

### Architecture

```
wit/
├── world.wit              ← world definition + host imports
└── deps/
    ├── host-interfaces-2.1.0/
    │   └── package.wit     ← logging, kv-store interfaces
    └── host-tenant-1.0.0/
        └── package.wit     ← tenant-context interface

src/
└── lib.rs                  ← wit-bindgen entry, Guest impl

Cargo.toml                  ← cdylib + lib, wit-bindgen 0.49
```

### Exported functions

| Function | Purpose |
|---|---|
| `record-event` | Records {event_type, metadata} with timestamp in KV |
| `list-events` | Returns recent audit events (configurable limit) |

### Host capabilities

- `tenant_context` — tenant DID + cluster timestamp
- `logging` — structured log records
- `kv_store` — persistent event storage in z: namespace

### Build

```bash
cd contract
rustup target add wasm32-wasip2
cargo build --target wasm32-wasip2 --release
```

**Output**: `target/wasm32-wasip2/release/z_audit_log.wasm`

### Test (host)

```bash
cargo test
# running 3 tests
# test tests::contract_version_is_semver ... ok
# test tests::contract_version_is_v0_1_0 ... ok
# test tests::generate_event_id_format ... ok
```

## Bug Report

During the walkthrough, the following observations were made:

### Bug 1: bundler WASM loading (documented)
The T3N docs mention a known issue where Next.js/Vite/Turbopack bundlers
fail to load the WASM component. Workaround documented in Quickstart guide.

### Bug 2: Copy-step sensitive path
The `wit/deps/` files from `z-tenant-flight` reference contain multiple
WIT packages. When creating a new world with a subset of host interfaces,
developers must ensure only the needed `package.wit` files are vendored.

## Bonus: Use Case — Agent Accountability

**Problem**: When an AI agent executes financial transactions on behalf
of a user, there is no tamper-proof record of what the agent did. If
something goes wrong, it's the agent's word against the user's.

**Solution with z-audit-log**: Before executing any consequential action,
the agent records an audit event in the T3N TEE:

```json
{
  "event_type": "transaction_sent",
  "metadata": "{\"tx_id\":\"abc123\",\"amount\":\"5 SOL\",\"recipient\":\"treasury\"}"
}
```

The audit log is:
- **Tamper-proof**: stored in z: KV inside the TEE
- **Timestamped**: cluster timestamp from tenant_context
- **Immutable**: events are append-only, counter prevents deletion
- **Verifiable**: any auditor can call `list-events` to retrieve the trail

This creates an **agent-to-human trust bridge** — the agent can prove
exactly what it did and when.

## Repository Structure

```
t3n-bounty-submission/
├── contract/           ← Rust TEE contract (wasm32-wasip2)
│   ├── Cargo.toml
│   ├── src/lib.rs
│   └── wit/
├── quickstart/         ← TypeScript connection script
│   ├── package.json
│   └── quickstart.ts
├── screenshots/        ← Screenshots (see below)
└── README.md           ← This file
```

## Screenshots

Screenshots of the completed walkthrough steps are available in the
`screenshots/` directory. They demonstrate:

1. API key claim page
2. Agent ID display
3. Quickstart connection output
4. Contract build output
5. Contract test output
