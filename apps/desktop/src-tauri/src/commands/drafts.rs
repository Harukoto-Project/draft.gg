use draftgg_storage::{SavedDraft, SavedDraftInput, Storage};
use tauri::State;

/// 新しい順
#[tauri::command]
pub fn list_drafts(storage: State<'_, Storage>) -> Vec<SavedDraft> {
    storage.list_drafts()
}

#[tauri::command]
pub fn save_draft(
    storage: State<'_, Storage>,
    input: SavedDraftInput,
) -> Result<SavedDraft, String> {
    storage.save_draft(input).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn delete_draft(storage: State<'_, Storage>, id: String) -> Result<(), String> {
    storage.delete_draft(&id).map_err(|error| error.to_string())
}
