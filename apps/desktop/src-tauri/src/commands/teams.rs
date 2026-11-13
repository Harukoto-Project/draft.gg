use draftgg_storage::{Storage, Team, TeamInput, TeamPatch};
use tauri::State;

#[tauri::command]
pub fn list_teams(storage: State<'_, Storage>) -> Vec<Team> {
    storage.list_teams()
}

#[tauri::command]
pub fn create_team(storage: State<'_, Storage>, input: TeamInput) -> Result<Team, String> {
    storage
        .create_team(input)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn update_team(
    storage: State<'_, Storage>,
    id: String,
    patch: TeamPatch,
) -> Result<Team, String> {
    storage
        .update_team(&id, patch)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn delete_team(storage: State<'_, Storage>, id: String) -> Result<(), String> {
    storage.delete_team(&id).map_err(|error| error.to_string())
}
