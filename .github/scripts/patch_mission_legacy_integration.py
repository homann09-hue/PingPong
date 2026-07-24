from pathlib import Path

path = Path("apps/api/src/spins/postgres-spin-store.integration.test.ts")
text = path.read_text()


def replace_once(old: str, new: str, marker: str) -> None:
    global text
    if marker in text:
        print(f"skip legacy integration: {marker}")
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"legacy integration: expected one anchor for {marker}, found {count}")
    text = text.replace(old, new)
    print(f"patched legacy integration: {marker}")


replace_once(
    '''  "034_mission_catalog_v3.sql",
  "035_player_progression_curve_v1.sql",
];''',
    '''  "034_mission_catalog_v3.sql",
  "035_player_progression_curve_v1.sql",
  "036_inventory_ledger_v1.sql",
  "037_loot_openings_v1.sql",
  "038_achievement_persistence_v1.sql",
  "039_achievement_immutability.sql",
  "040_achievement_authoritative_backfill.sql",
  "041_loot_entitlements_v1.sql",
  "042_loot_entitlement_invariants.sql",
  "043_achievement_loot_rewards_v1.sql",
  "044_achievement_loot_reward_invariants.sql",
  "045_mission_claims_and_loot_rewards_v1.sql",
  "046_mission_claim_invariants.sql",
];''',
    '"046_mission_claim_invariants.sql"',
)
replace_once(
    '''    await pool.query(
      "INSERT INTO mission_definitions (id,version,cadence,tier,translation_key,metric,target,reward_coins) VALUES ($1,1,'daily','standard',$2,'spin_count',1,1234)",
      [missionId, `mission.${missionId}`],
    );''',
    '''    await pool.query(
      `INSERT INTO mission_definition_versions
         (mission_id,version,cadence,tier,translation_key,metric,target,reward_coins,
          reward_mission_points,reward_loyalty_points,reward_stamps,reward_toolboxes,reward_boosters,
          unlock_daily_claims,unlock_pro_claims,reward_loot_table_id,reward_loot_table_version,
          reward_loot_expires_in_seconds,active,published_at,metadata)
       VALUES ($1,1,'daily','standard',$2,'spin_count',1,1234,0,0,0,0,0,0,0,
               'mission-standard-reward',1,604800,true,now(),'{}')`,
      [missionId, `mission.${missionId}`],
    );
    await pool.query(
      `INSERT INTO mission_definitions
         (id,version,cadence,tier,translation_key,metric,target,reward_coins,
          reward_mission_points,reward_loyalty_points,reward_stamps,reward_toolboxes,reward_boosters,
          unlock_daily_claims,unlock_pro_claims,active)
       VALUES ($1,1,'daily','standard',$2,'spin_count',1,1234,0,0,0,0,0,0,0,true)`,
      [missionId, `mission.${missionId}`],
    );''',
    "INSERT INTO mission_definition_versions",
)
replace_once(
    '''    const missionClaim = await store.claimMission(playerId, missionId, new Date());
    expect(missionClaim).toMatchObject({ missionId, coins: 1234 });
    expect((await store.getMissions(playerId, new Date())).find((mission) => mission.id === "weekly-bar-1"))
      .toMatchObject({ progress: 1, completed: true });
    await expect(store.claimMission(playerId, missionId, new Date())).rejects.toBeInstanceOf(Error);''',
    '''    const missionClaimCommand = { playerId, missionId, idempotencyKey: randomUUID() };
    const missionClaim = await store.claimMission(missionClaimCommand, new Date());
    expect(missionClaim).toMatchObject({ missionId, missionVersion: 1, coins: 1234, replayed: false });
    expect((await store.getMissions(playerId, new Date())).find((mission) => mission.id === "weekly-bar-1"))
      .toMatchObject({ progress: 1, completed: true });
    const missionReplay = await store.claimMission(missionClaimCommand, new Date());
    expect(missionReplay.claimId).toBe(missionClaim.claimId);
    expect(missionReplay.replayed).toBe(true);''',
    "const missionClaimCommand =",
)

path.write_text(text)
