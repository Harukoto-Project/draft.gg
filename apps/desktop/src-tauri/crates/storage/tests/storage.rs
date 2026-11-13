//! ローカル保存。検証の規則は TS 版(zod スキーマと `packages/db` のストア)と同じ。

use draftgg_engine::Position;
use draftgg_storage::*;
use serde_json::json;

fn open() -> (tempfile::TempDir, Storage) {
    let dir = tempfile::tempdir().unwrap();
    let storage = Storage::open(dir.path());
    (dir, storage)
}

fn input(name: &str) -> ProfileInput {
    ProfileInput {
        display_name: name.to_string(),
        riot_id: None,
        region: None,
        roles: vec![],
    }
}

fn entry(champion: &str, position: Position) -> PoolEntry {
    PoolEntry {
        champion_id: champion.to_string(),
        position,
        source: PoolSource::Manual,
        games: None,
        win_rate: None,
        excluded: false,
    }
}

// ---- プレイヤー ----

#[test]
fn プレイヤーを作ると_前後の空白を除いて保存し_作成順に並べる() {
    let (_dir, storage) = open();
    let profile = storage
        .create_profile(ProfileInput {
            display_name: "  たろう  ".into(),
            riot_id: Some(" Taro#JP1 ".into()),
            region: Some("JP".into()),
            roles: vec![Position::Mid, Position::Top],
        })
        .unwrap();
    storage.create_profile(input("じろう")).unwrap();

    assert!(!profile.id.is_empty());
    assert_eq!(profile.display_name, "たろう");
    assert_eq!(profile.riot_id.as_deref(), Some("Taro#JP1"));
    assert_eq!(profile.synced_at, None);
    assert!(profile.pool.is_empty());
    let names: Vec<_> = storage
        .list_profiles()
        .into_iter()
        .map(|p| p.display_name)
        .collect();
    assert_eq!(names, ["たろう", "じろう"]);
}

#[test]
fn 規則に合わないプレイヤーは作れない() {
    let (_dir, storage) = open();
    let bad = |change: fn(&mut ProfileInput)| {
        let mut value = input("たろう");
        change(&mut value);
        storage.create_profile(value)
    };
    let invalid = |result: Result<Profile, StorageError>| {
        assert!(
            matches!(result, Err(StorageError::Invalid(_))),
            "{result:?}"
        )
    };

    invalid(bad(|v| v.display_name = "   ".into()));
    invalid(bad(|v| v.display_name = "あ".repeat(51)));
    invalid(bad(|v| v.riot_id = Some("TaroJP".into())));
    invalid(bad(|v| v.riot_id = Some("#JP1".into())));
    invalid(bad(|v| v.riot_id = Some("Taro#TOOLONG".into())));
    invalid(bad(|v| v.region = Some("XX".into())));
    invalid(bad(|v| v.roles = vec![Position::Top, Position::Top]));
    assert!(storage.list_profiles().is_empty());
}

#[test]
fn プレイヤーは_30_人まで() {
    let (_dir, storage) = open();
    for index in 0..30 {
        storage.create_profile(input(&format!("p{index}"))).unwrap();
    }
    assert_eq!(
        storage.create_profile(input("あふれ")).unwrap_err(),
        StorageError::Limit
    );
}

#[test]
fn プレイヤーの更新は渡した項目だけ変え_null_で消せる() {
    let (_dir, storage) = open();
    let created = storage
        .create_profile(ProfileInput {
            display_name: "たろう".into(),
            riot_id: Some("Taro#JP1".into()),
            region: Some("JP".into()),
            roles: vec![Position::Mid],
        })
        .unwrap();

    let renamed = storage
        .update_profile(
            &created.id,
            ProfilePatch {
                display_name: Some("たろ".into()),
                ..Default::default()
            },
        )
        .unwrap();
    assert_eq!(renamed.display_name, "たろ");
    assert_eq!(renamed.riot_id.as_deref(), Some("Taro#JP1"));

    let cleared = storage
        .update_profile(
            &created.id,
            ProfilePatch {
                riot_id: Some(None),
                region: Some(None),
                ..Default::default()
            },
        )
        .unwrap();
    assert_eq!(cleared.riot_id, None);
    assert_eq!(cleared.region, None);
    assert_eq!(cleared.roles, vec![Position::Mid]);
}

#[test]
fn プレイヤーの更新の_null_と項目なしを_json_から区別できる() {
    let cleared: ProfilePatch = serde_json::from_value(json!({"riotId": null})).unwrap();
    assert_eq!(cleared.riot_id, Some(None));
    let untouched: ProfilePatch = serde_json::from_value(json!({})).unwrap();
    assert_eq!(untouched.riot_id, None);
    let set: ProfilePatch = serde_json::from_value(json!({"riotId": "A#B"})).unwrap();
    assert_eq!(set.riot_id, Some(Some("A#B".to_string())));
}

#[test]
fn 存在しないプレイヤーの更新と削除は_not_found_不正な更新は_invalid() {
    let (_dir, storage) = open();
    assert_eq!(
        storage
            .update_profile("nope", ProfilePatch::default())
            .unwrap_err(),
        StorageError::NotFound
    );
    assert_eq!(
        storage.delete_profile("nope").unwrap_err(),
        StorageError::NotFound
    );

    let created = storage.create_profile(input("たろう")).unwrap();
    let result = storage.update_profile(
        &created.id,
        ProfilePatch {
            region: Some(Some("XX".into())),
            ..Default::default()
        },
    );
    assert!(matches!(result, Err(StorageError::Invalid(_))));
    assert_eq!(storage.list_profiles()[0].region, None);
}

// ---- プール ----

#[test]
fn プールを置き換えて読み戻せる() {
    let (_dir, storage) = open();
    let created = storage.create_profile(input("たろう")).unwrap();
    let mut opgg = entry("Ahri", Position::Mid);
    opgg.source = PoolSource::Opgg;
    opgg.games = Some(120);
    opgg.win_rate = Some(0.55);

    let updated = storage
        .set_pool(&created.id, vec![opgg.clone(), entry("Zed", Position::Mid)])
        .unwrap();
    assert_eq!(updated.pool.len(), 2);
    assert_eq!(updated.pool[0], opgg);
    assert_eq!(storage.list_profiles()[0].pool, updated.pool);

    let emptied = storage.set_pool(&created.id, vec![]).unwrap();
    assert!(emptied.pool.is_empty());
}

#[test]
fn 不正なプールは受け付けず_元のプールを残す() {
    let (_dir, storage) = open();
    let created = storage.create_profile(input("たろう")).unwrap();
    storage
        .set_pool(&created.id, vec![entry("Ahri", Position::Mid)])
        .unwrap();
    let invalid = |entries: Vec<PoolEntry>| {
        let result = storage.set_pool(&created.id, entries);
        assert!(
            matches!(result, Err(StorageError::Invalid(_))),
            "{result:?}"
        );
    };

    // 同じチャンピオン × ロールの重複(ロールが違えば別)
    invalid(vec![
        entry("Zed", Position::Mid),
        entry("Zed", Position::Mid),
    ]);
    let mut bad_rate = entry("Zed", Position::Mid);
    bad_rate.win_rate = Some(1.5);
    invalid(vec![bad_rate]);
    invalid(vec![entry("", Position::Mid)]);
    invalid(vec![entry(&"x".repeat(65), Position::Mid)]);
    let too_many = (0..101)
        .map(|index| entry(&format!("C{index}"), Position::Top))
        .collect();
    invalid(too_many);

    assert_eq!(storage.list_profiles()[0].pool.len(), 1);
    assert!(storage
        .set_pool(
            &created.id,
            vec![entry("Zed", Position::Mid), entry("Zed", Position::Top)]
        )
        .is_ok());
    assert_eq!(
        storage.set_pool("nope", vec![]).unwrap_err(),
        StorageError::NotFound
    );
}

fn synced(champion: &str, position: Position, games: u64) -> PoolEntry {
    PoolEntry {
        source: PoolSource::Opgg,
        games: Some(games),
        win_rate: Some(0.5),
        ..entry(champion, position)
    }
}

#[test]
fn 同期の結果は_手動を残し_opgg_由来を入れ替え_除外を引き継ぎ_同期日時を記録する() {
    let (_dir, storage) = open();
    let created = storage.create_profile(input("たろう")).unwrap();
    let mut old_excluded = synced("Zed", Position::Mid, 10);
    old_excluded.excluded = true;
    storage
        .set_pool(
            &created.id,
            vec![
                entry("Ahri", Position::Mid),
                old_excluded,
                synced("Lux", Position::Mid, 5),
            ],
        )
        .unwrap();

    let updated = storage
        .apply_pool_sync(
            &created.id,
            vec![
                synced("Ahri", Position::Mid, 99),
                synced("Zed", Position::Mid, 40),
                synced("Yone", Position::Mid, 30),
            ],
        )
        .unwrap();

    let keys: Vec<_> = updated
        .pool
        .iter()
        .map(|e| (e.champion_id.as_str(), e.source, e.excluded, e.games))
        .collect();
    assert_eq!(
        keys,
        vec![
            ("Ahri", PoolSource::Manual, false, None),
            ("Zed", PoolSource::Opgg, true, Some(40)),
            ("Yone", PoolSource::Opgg, false, Some(30)),
        ]
    );
    let synced_at = updated.synced_at.clone().expect("synced_at");
    assert!(synced_at.ends_with('Z') && synced_at.contains('T'));
    assert_eq!(storage.list_profiles()[0], updated);
}

#[test]
fn 同期の結果が不正なら_何も変えない() {
    let (_dir, storage) = open();
    let created = storage.create_profile(input("たろう")).unwrap();
    let before = storage
        .set_pool(&created.id, vec![entry("Ahri", Position::Mid)])
        .unwrap();

    let duplicated = vec![
        synced("Zed", Position::Mid, 1),
        synced("Zed", Position::Mid, 2),
    ];
    assert!(matches!(
        storage.apply_pool_sync(&created.id, duplicated),
        Err(StorageError::Invalid(_))
    ));
    assert!(matches!(
        storage.apply_pool_sync("nope", vec![]),
        Err(StorageError::NotFound)
    ));
    assert_eq!(storage.list_profiles()[0], before);
}

#[test]
fn 同期の結果は_手動と合わせて_100_件まで() {
    let (_dir, storage) = open();
    let created = storage.create_profile(input("たろう")).unwrap();
    let fetched: Vec<_> = (0..120)
        .map(|n| synced(&format!("Champ{n}"), Position::Top, 1))
        .collect();

    let updated = storage.apply_pool_sync(&created.id, fetched).unwrap();
    assert_eq!(updated.pool.len(), 100);
}
// ---- チーム ----

fn members(pairs: &[(Position, &str)]) -> TeamMembers {
    pairs
        .iter()
        .map(|(position, id)| (*position, id.to_string()))
        .collect()
}

#[test]
fn チームを作って並べる() {
    let (_dir, storage) = open();
    let a = storage.create_profile(input("A")).unwrap();
    let b = storage.create_profile(input("B")).unwrap();

    let team = storage
        .create_team(TeamInput {
            name: "  チーム1  ".into(),
            members: members(&[(Position::Top, &a.id), (Position::Mid, &b.id)]),
        })
        .unwrap();
    storage
        .create_team(TeamInput {
            name: "チーム2".into(),
            members: TeamMembers::new(),
        })
        .unwrap();

    assert_eq!(team.name, "チーム1");
    assert_eq!(team.members.len(), 2);
    let names: Vec<_> = storage.list_teams().into_iter().map(|t| t.name).collect();
    assert_eq!(names, ["チーム1", "チーム2"]);
}

#[test]
fn 規則に合わないチームは作れない() {
    let (_dir, storage) = open();
    let a = storage.create_profile(input("A")).unwrap();

    let blank = storage.create_team(TeamInput {
        name: " ".into(),
        members: TeamMembers::new(),
    });
    assert!(matches!(blank, Err(StorageError::Invalid(_))));
    let long = storage.create_team(TeamInput {
        name: "あ".repeat(51),
        members: TeamMembers::new(),
    });
    assert!(matches!(long, Err(StorageError::Invalid(_))));
    // 同じプレイヤーを複数のロールに置けない
    let duplicate = storage.create_team(TeamInput {
        name: "T".into(),
        members: members(&[(Position::Top, &a.id), (Position::Mid, &a.id)]),
    });
    assert!(matches!(duplicate, Err(StorageError::Invalid(_))));
    let unknown = storage.create_team(TeamInput {
        name: "T".into(),
        members: members(&[(Position::Top, "nope")]),
    });
    assert_eq!(unknown.unwrap_err(), StorageError::UnknownProfile);
    assert!(storage.list_teams().is_empty());
}

#[test]
fn チームは_10_個まで() {
    let (_dir, storage) = open();
    for index in 0..10 {
        storage
            .create_team(TeamInput {
                name: format!("t{index}"),
                members: TeamMembers::new(),
            })
            .unwrap();
    }
    let result = storage.create_team(TeamInput {
        name: "あふれ".into(),
        members: TeamMembers::new(),
    });
    assert_eq!(result.unwrap_err(), StorageError::Limit);
}

#[test]
fn チームの更新は_メンバーを渡したときだけ割り当て全体を置き換える() {
    let (_dir, storage) = open();
    let a = storage.create_profile(input("A")).unwrap();
    let b = storage.create_profile(input("B")).unwrap();
    let team = storage
        .create_team(TeamInput {
            name: "T".into(),
            members: members(&[(Position::Top, &a.id)]),
        })
        .unwrap();

    let renamed = storage
        .update_team(
            &team.id,
            TeamPatch {
                name: Some("T2".into()),
                ..Default::default()
            },
        )
        .unwrap();
    assert_eq!(renamed.name, "T2");
    assert_eq!(renamed.members, members(&[(Position::Top, &a.id)]));

    let replaced = storage
        .update_team(
            &team.id,
            TeamPatch {
                members: Some(members(&[(Position::Mid, &b.id)])),
                ..Default::default()
            },
        )
        .unwrap();
    assert_eq!(replaced.members, members(&[(Position::Mid, &b.id)]));

    let bad = storage.update_team(
        &team.id,
        TeamPatch {
            members: Some(members(&[(Position::Mid, "nope")])),
            ..Default::default()
        },
    );
    assert_eq!(bad.unwrap_err(), StorageError::UnknownProfile);
    assert_eq!(
        storage.list_teams()[0].members,
        members(&[(Position::Mid, &b.id)])
    );
    assert_eq!(
        storage
            .update_team("nope", TeamPatch::default())
            .unwrap_err(),
        StorageError::NotFound
    );
}

#[test]
fn チームの削除と_プレイヤー削除時のチームからの取り外し() {
    let (_dir, storage) = open();
    let a = storage.create_profile(input("A")).unwrap();
    let b = storage.create_profile(input("B")).unwrap();
    let team = storage
        .create_team(TeamInput {
            name: "T".into(),
            members: members(&[(Position::Top, &a.id), (Position::Mid, &b.id)]),
        })
        .unwrap();

    storage.delete_profile(&a.id).unwrap();
    assert_eq!(
        storage.list_teams()[0].members,
        members(&[(Position::Mid, &b.id)])
    );

    storage.delete_team(&team.id).unwrap();
    assert!(storage.list_teams().is_empty());
    assert_eq!(
        storage.delete_team(&team.id).unwrap_err(),
        StorageError::NotFound
    );
}

// ---- 保存ドラフト ----

fn draft_state(label: &str) -> serde_json::Value {
    json!({"format": "ranked", "mySide": "blue", "label": label})
}

#[test]
fn ドラフトは新しい順に返し_メモの空白を除く() {
    let (_dir, storage) = open();
    storage
        .save_draft(SavedDraftInput {
            state: draft_state("1"),
            note: "  古い  ".into(),
        })
        .unwrap();
    let newer = storage
        .save_draft(SavedDraftInput {
            state: draft_state("2"),
            note: String::new(),
        })
        .unwrap();

    let drafts = storage.list_drafts();
    assert_eq!(drafts[0].id, newer.id);
    assert_eq!(drafts[1].note, "古い");
    assert_eq!(drafts[0].state, draft_state("2"));
    assert!(drafts[0].created_at.ends_with('Z'));
}

#[test]
fn 不正なドラフトは保存できず_上限は_50_件() {
    let (_dir, storage) = open();
    let long = storage.save_draft(SavedDraftInput {
        state: draft_state("x"),
        note: "あ".repeat(201),
    });
    assert!(matches!(long, Err(StorageError::Invalid(_))));
    let not_object = storage.save_draft(SavedDraftInput {
        state: json!("x"),
        note: String::new(),
    });
    assert!(matches!(not_object, Err(StorageError::Invalid(_))));

    for index in 0..50 {
        storage
            .save_draft(SavedDraftInput {
                state: draft_state(&index.to_string()),
                note: String::new(),
            })
            .unwrap();
    }
    let result = storage.save_draft(SavedDraftInput {
        state: draft_state("あふれ"),
        note: String::new(),
    });
    assert_eq!(result.unwrap_err(), StorageError::Limit);

    let first = storage.list_drafts().pop().unwrap();
    storage.delete_draft(&first.id).unwrap();
    assert_eq!(storage.list_drafts().len(), 49);
    assert_eq!(
        storage.delete_draft(&first.id).unwrap_err(),
        StorageError::NotFound
    );
}

// ---- 永続化 ----

#[test]
fn 開き直しても残る() {
    let dir = tempfile::tempdir().unwrap();
    {
        let storage = Storage::open(dir.path());
        let profile = storage.create_profile(input("たろう")).unwrap();
        storage
            .set_pool(&profile.id, vec![entry("Ahri", Position::Mid)])
            .unwrap();
        storage
            .save_draft(SavedDraftInput {
                state: draft_state("1"),
                note: "メモ".into(),
            })
            .unwrap();
    }
    let reopened = Storage::open(dir.path());
    assert_eq!(reopened.list_profiles()[0].pool.len(), 1);
    assert_eq!(reopened.list_drafts()[0].note, "メモ");
}

#[test]
fn 壊れたファイルは退避して空から始める() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("userdata.json"), "{ broken").unwrap();

    let storage = Storage::open(dir.path());
    assert!(storage.list_profiles().is_empty());
    assert_eq!(
        std::fs::read_to_string(dir.path().join("userdata.corrupt.json")).unwrap(),
        "{ broken"
    );
    // 以降は普通に保存できる
    storage.create_profile(input("たろう")).unwrap();
    assert_eq!(Storage::open(dir.path()).list_profiles().len(), 1);
}

#[test]
fn 保存に失敗したら_エラーを返し_メモリ上も元に戻す() {
    let dir = tempfile::tempdir().unwrap();
    // 保存先のフォルダの場所にファイルがあって、作れない
    let blocked = dir.path().join("blocked");
    std::fs::write(&blocked, "x").unwrap();
    let storage = Storage::open(&blocked);

    let result = storage.create_profile(input("たろう"));
    assert!(matches!(result, Err(StorageError::Io(_))), "{result:?}");
    assert!(storage.list_profiles().is_empty());
}
