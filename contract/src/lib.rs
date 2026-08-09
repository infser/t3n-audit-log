//! z-audit-log v0.1.0 — Trusted Agent Audit Log.
//!
//! A lightweight TEE contract demonstrating core T3N ADK patterns:
//!   - `record-event`: logs a timestamped audit event into z: KV storage.
//!   - `list-events`: retrieves recent audit events from KV storage.
//!
//! No HTTP, no external APIs — only host interfaces every tenant has by
//! default: tenant-context, logging, kv-store.
//!
//! # Use case
//!
//! An AI agent records every consequential action it takes (e.g., "sent 5 SOL
//! to treasury", "approved transaction #42") into the TEE audit log. Because
//! the log lives inside the T3N TEE and is only writable by the contract, it
//! provides a tamper-proof record of agent activity — useful for compliance,
//! debugging, and accountability.
//!
//! # Host-capability requirements
//!
//! ```json
//! {
//!   "host_capabilities": ["kv_store", "logging", "tenant_context"]
//! }
//! ```
//!
//! # Setup
//!
//! Before first use, the tenant SDK must create the `events` KV map:
//! ```text
//! // Via the tenant SDK:
//! z_sdk.kv("events").create()
//! ```
#![warn(clippy::style)]
#![cfg_attr(not(target_arch = "wasm32"), allow(dead_code))]

extern crate alloc;

use alloc::string::String;
use alloc::vec::Vec;

pub const CONTRACT_VERSION: &str = "0.1.0";

wit_bindgen::generate!({
    world: "audit-log",
    path: "wit",
    additional_derives: [
        serde::Deserialize,
        serde::Serialize,
    ],
    generate_all,
});

#[allow(unused_imports)]
use host::interfaces::{kv_store, logging};
use host::tenant::tenant_context;

const KV_MAP_NAME: &str = "events";
const MAX_EVENTS_PER_PAGE: u32 = 100;

struct Component;

#[derive(serde::Deserialize)]
struct RecordEventInput {
    event_type: String,
    metadata: String,
}

#[derive(serde::Serialize)]
struct RecordEventOutput {
    id: String,
    timestamp: String,
    event_type: String,
}

#[derive(serde::Deserialize)]
struct ListEventsInput {
    #[serde(default = "default_limit")]
    limit: u32,
}

fn default_limit() -> u32 {
    10
}

#[derive(serde::Serialize, serde::Deserialize)]
struct AuditEvent {
    id: String,
    timestamp: String,
    event_type: String,
    metadata: String,
}

#[derive(serde::Serialize)]
struct ListEventsOutput {
    events: Vec<AuditEvent>,
}

/// Generate a unique event ID from the tenant DID and a counter.
fn generate_event_id(tid: &str, counter: u64) -> String {
    alloc::format!("evt_{}_{}", &tid[..8.min(tid.len())], counter)
}

/// Build the full z: KV map path for this tenant.
fn events_map_name() -> String {
    let tid_bytes = tenant_context::tenant_did();
    let tid = String::from_utf8(tid_bytes).unwrap_or_default();
    alloc::format!("z:{}:{}", tid, KV_MAP_NAME)
}

/// Helper: convert tenant_did() bytes to string.
fn tenant_did_str() -> String {
    String::from_utf8(tenant_context::tenant_did()).unwrap_or_default()
}

#[cfg(target_arch = "wasm32")]
impl exports::z::audit_log::contracts::Guest for Component {
    fn record_event(
        req: exports::z::audit_log::contracts::GenericInput,
    ) -> Result<Vec<u8>, String> {
        let input_bytes = req.input.ok_or("record-event: missing input")?;
        let input: RecordEventInput =
            serde_json::from_slice(&input_bytes).map_err(|e| alloc::format!("invalid input JSON: {e}"))?;

        // Validate input.
        if input.event_type.is_empty() {
            return Err("event_type must not be empty".to_string());
        }
        if input.event_type.len() > 128 {
            return Err("event_type too long (max 128 chars)".to_string());
        }
        if input.metadata.len() > 4096 {
            return Err("metadata too long (max 4096 chars)".to_string());
        }

        let map_name = events_map_name();
        let tid = tenant_did_str();

        // Read current counter (or start at 0).
        let counter_key = b"_counter";
        let counter: u64 = match kv_store::get(&map_name, counter_key)
            .map_err(|e| alloc::format!("kv read counter: {e}"))?
        {
            Some(bytes) => {
                let s = String::from_utf8(bytes)
                    .map_err(|_| "counter value is not valid UTF-8".to_string())?;
                s.parse::<u64>().map_err(|_| "counter value is not a number".to_string())?
            }
            None => 0,
        };

        // Generate event ID and timestamp.
        let event_id = generate_event_id(&tid, counter);
        let timestamp = tenant_context::cluster_timestamp_secs();
        let timestamp_str = alloc::format!("{}", timestamp);

        // Store the event.
        let event_value = serde_json::to_vec(&AuditEvent {
            id: event_id.clone(),
            timestamp: timestamp_str.clone(),
            event_type: input.event_type.clone(),
            metadata: input.metadata.clone(),
        })
        .map_err(|e| alloc::format!("failed to serialize event: {e}"))?;

        let event_key = alloc::format!("event_{}", counter);
        kv_store::put(&map_name, event_key.as_bytes(), &event_value)
            .map_err(|e| alloc::format!("kv write event: {e}"))?;

        // Increment counter.
        let new_counter = counter + 1;
        kv_store::put(
            &map_name,
            counter_key,
            new_counter.to_string().as_bytes(),
        )
        .map_err(|e| alloc::format!("kv write counter: {e}"))?;

        let _ = logging::info(&alloc::format!(
            "recorded audit event {} (type: {}, counter: {})",
            event_id, input.event_type, counter
        ));

        let output = RecordEventOutput {
            id: event_id,
            timestamp: timestamp_str,
            event_type: input.event_type,
        };

        serde_json::to_vec(&output).map_err(|e| alloc::format!("serialize output: {e}"))
    }

    fn list_events(
        req: exports::z::audit_log::contracts::GenericInput,
    ) -> Result<Vec<u8>, String> {
        let input_bytes = req.input.ok_or("list-events: missing input")?;
        let input: ListEventsInput =
            serde_json::from_slice(&input_bytes).map_err(|e| alloc::format!("invalid input JSON: {e}"))?;

        let limit = input.limit.min(MAX_EVENTS_PER_PAGE).max(1);

        let map_name = events_map_name();

        // Read counter to know how many events exist.
        let counter_key = b"_counter";
        let total = match kv_store::get(&map_name, counter_key)
            .map_err(|e| alloc::format!("kv read counter: {e}"))?
        {
            Some(bytes) => {
                let s = String::from_utf8(bytes)
                    .map_err(|_| "counter value is not valid UTF-8".to_string())?;
                s.parse::<u64>().map_err(|_| "counter value is not a number".to_string())?
            }
            None => 0,
        };

        let mut events: Vec<AuditEvent> = Vec::new();
        let start = if total > limit as u64 {
            total - limit as u64
        } else {
            0
        };

        for i in (start..total).rev() {
            let event_key = alloc::format!("event_{}", i);
            match kv_store::get(&map_name, event_key.as_bytes())
                .map_err(|e| alloc::format!("kv read event {i}: {e}"))?
            {
                Some(bytes) => {
                    let event: AuditEvent = serde_json::from_slice(&bytes)
                        .map_err(|e| alloc::format!("deserialize event {i}: {e}"))?;
                    events.push(event);
                }
                None => {
                    let _ = logging::info(&alloc::format!(
                        "event {} not found (possible gap in audit log)", i
                    ));
                }
            }
        }

        let _ = logging::info(&alloc::format!(
            "listed {} audit events (total: {})",
            events.len(),
            total
        ));

        let output = ListEventsOutput { events };
        serde_json::to_vec(&output).map_err(|e| alloc::format!("serialize output: {e}"))
    }
}

#[cfg(target_arch = "wasm32")]
export!(Component);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn contract_version_is_semver() {
        let parts: Vec<&str> = CONTRACT_VERSION.split('.').collect();
        assert_eq!(parts.len(), 3, "CONTRACT_VERSION must be MAJOR.MINOR.PATCH");
        for part in parts {
            assert!(part.parse::<u32>().is_ok(), "each part must be a number");
        }
    }

    #[test]
    fn contract_version_is_v0_1_0() {
        assert_eq!(CONTRACT_VERSION, "0.1.0");
    }

    #[test]
    fn generate_event_id_format() {
        let id = generate_event_id("did:t3n:abc123def456", 42);
        assert!(id.starts_with("evt_"), "event ID should start with evt_");
        assert!(id.contains("42"), "event ID should contain the counter");
    }
}
