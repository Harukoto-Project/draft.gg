//! LCU の `/lol-champ-select/v1/session` の JSON のうち、ドラフトに使う項目だけ。
//! 未知の項目は無視し、欠けている項目は既定値で埋める(クライアントの更新で形が少し変わっても動くように)。

use serde::Deserialize;

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Session {
    /// 手順のグループ。同じグループの手は同時に進み、グループ同士は順番に進む
    pub actions: Vec<Vec<Action>>,
    pub my_team: Vec<Player>,
    pub their_team: Vec<Player>,
    /// 観戦中は -1
    pub local_player_cell_id: i32,
    pub timer: Timer,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Action {
    pub actor_cell_id: i32,
    /// 未選択は 0。選択中(ホバー)の値も入るので、確定は `completed` で見る
    pub champion_id: i32,
    pub completed: bool,
    /// `ban` / `pick` のほか、BAN 公開の演出用の `ten_bans_reveal` などがある
    #[serde(rename = "type")]
    pub kind: String,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Player {
    pub cell_id: i32,
    /// `top` / `jungle` / `middle` / `bottom` / `utility`。割り当てがなければ空
    pub assigned_position: String,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Timer {
    /// `PLANNING` / `BAN_PICK` / `FINALIZATION` / `GAME_STARTING` など
    pub phase: String,
}
