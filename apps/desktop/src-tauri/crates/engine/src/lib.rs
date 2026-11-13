//! Draft.GG の提案計算。`packages/engine`(TS)の Rust 版で、DB・HTTP・Tauri には依存しない。
//! TS 版と同じ入力に同じ結果を返すことを、`tests/golden/` の golden で確かめている。

pub mod composition;
pub mod format;
pub mod model;
pub mod recommend;
pub mod request;
pub mod score;
pub mod weights;

pub use model::*;
pub use recommend::{recommend, RecommendInput};
pub use request::{recommend_for_request, RecommendationRequest, RequestError};
pub use weights::{BanWeights, PickWeights};
