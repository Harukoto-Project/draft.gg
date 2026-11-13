//! エラーは画面側が分岐できるコード(`not_found` / `invalid_input` / `limit_reached` など)

use draftgg_storage::{PoolEntry, Profile, ProfileInput, ProfilePatch, Storage};
use tauri::State;

#[tauri::command]
pub fn list_profiles(storage: State<'_, Storage>) -> Vec<Profile> {
    storage.list_profiles()
}

#[tauri::command]
pub fn create_profile(storage: State<'_, Storage>, input: ProfileInput) -> Result<Profile, String> {
    storage
        .create_profile(input)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn update_profile(
    storage: State<'_, Storage>,
    id: String,
    patch: ProfilePatch,
) -> Result<Profile, String> {
    storage
        .update_profile(&id, patch)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn delete_profile(storage: State<'_, Storage>, id: String) -> Result<(), String> {
    storage
        .delete_profile(&id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn set_pool(
    storage: State<'_, Storage>,
    id: String,
    entries: Vec<PoolEntry>,
) -> Result<Profile, String> {
    storage
        .set_pool(&id, entries)
        .map_err(|error| error.to_string())
}
