//! Bible Friend domain core.
//!
//! Ports of the TypeScript domain modules so the Rust shell and any future Rust
//! server share one implementation:
//! - [`growth`] ← `bible-friend-web/shared/growthDomain.ts` (web is the source of truth)
//! - [`safety`] ← `bible-friend-android/packages/core/src/safety.ts`
//!
//! JSON field names are camelCase so values round-trip with the web's tRPC API.

pub mod growth;
pub mod safety;
pub mod verses;
