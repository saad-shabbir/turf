import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fresh, actor, rpc, A, B, C } from "./database-harness.mjs";
test("overlapping observations remain review-only and long stays have no usable duration", async (t) => {
  const db = await paired();
  t.after(() => db.close());
  const { place, device } = await captureSetup(db);
  const second = await rpc(db, "save_my_place", [
    {
      label: "Synthetic overlap",
      category: "work",
      latitude: 0,
      longitude: 0,
      radius_m: 150,
    },
  ]);
  const session = await rpc(db, "begin_capture", [device.id]);
  await db.exec("reset role");
  await db.query(
    "update tracking_sessions set started_at=now()-interval '2 days' where id=$1",
    [session.id],
  );
  await db.exec("update places set created_at=now()-interval '2 days'");
  await actor(db, A);
  const base = Date.now() - 86400000;
  const e = (seq, pid, kind, seconds) => ({
    event_id: randomUUID(),
    platform_event_id: randomUUID(),
    session_id: session.id,
    device_id: device.id,
    place_id: pid,
    client_seq: seq,
    kind,
    observed_at: new Date(base + seconds * 1000).toISOString(),
    initial_state_possible: false,
  });
  await rpc(db, "ingest_geofence_batch", [
    [
      e(1, place.id, "EXIT", 0),
      e(2, second.id, "EXIT", 0),
      e(3, place.id, "ENTER", 60),
      e(4, second.id, "ENTER", 70),
      e(5, place.id, "EXIT", 180),
      e(6, second.id, "EXIT", 200),
    ],
    [],
  ]);
  const overlap = (await db.query("select * from visits")).rows;
  assert.equal(overlap.length, 2);
  for (const v of overlap) {
    assert.equal(v.quality_reason, "OVERLAP");
    assert.equal(v.dwell_seconds, null);
  }
  const long = e(7, place.id, "ENTER", 1000);
  await rpc(db, "ingest_geofence_batch", [
    [long, e(8, place.id, "EXIT", 16000)],
    [],
  ]);
  assert.equal(
    (
      await db.query("select quality_reason from visits where id=$1", [
        long.event_id,
      ])
    ).rows[0].quality_reason,
    "LONG_VISIT",
  );
  await db.exec("reset role");
  await db.query(
    "update visits set observed_start_at=now()-interval '92 days',observed_end_at=now()-interval '91 days' where id=$1",
    [long.event_id],
  );
  await actor(db, A);
  await rpc(db, "cleanup_my_retention");
  assert.equal(
    (await db.query("select * from visits where id=$1", [long.event_id])).rows
      .length,
    0,
  );
});
async function paired() {
  const db = await fresh();
  await actor(db, A);
  const inv = await rpc(db, "create_pair_invite");
  await actor(db, B);
  await rpc(db, "join_pair", [inv.invite_code]);
  await actor(db, A);
  await rpc(db, "update_my_settings", [{ collection_consent: true }]);
  return db;
}
async function captureSetup(db, category = "gym") {
  const place = await rpc(db, "save_my_place", [
    {
      label: "Synthetic region",
      category,
      latitude: 0,
      longitude: 0,
      radius_m: 150,
    },
  ]);
  const device = await rpc(db, "claim_device", [
    randomUUID(),
    { app: "test", os: "test" },
  ]);
  const session = await rpc(db, "begin_capture", [device.id]);
  // Admin changes only fixture time; all observations still enter through app role.
  await db.exec("reset role");
  await db.query(
    "update public.tracking_sessions set started_at=now()-interval '2 days' where id=$1",
    [session.id],
  );
  await db.query(
    "update public.places set created_at=now()-interval '2 days' where id=$1",
    [place.id],
  );
  await actor(db, A);
  const base = Date.now() - 86400000;
  const event = (seq, kind, seconds, initial = false) => ({
    event_id: randomUUID(),
    platform_event_id: randomUUID(),
    session_id: session.id,
    device_id: device.id,
    place_id: place.id,
    client_seq: seq,
    kind,
    observed_at: new Date(base + seconds * 1000).toISOString(),
    initial_state_possible: initial,
  });
  return { place, device, session, event };
}
test("initial inside, orphan exit, reversed clock and interrupted open visits never fabricate duration", async (t) => {
  const db = await paired();
  t.after(() => db.close());
  const { session, event } = await captureSetup(db);
  await rpc(db, "ingest_geofence_batch", [
    [event(1, "ENTER", 0, true), event(2, "EXIT", 60)],
    [],
  ]);
  let v = (await db.query("select * from visits")).rows[0];
  assert.equal(v.status, "needs_review");
  assert.equal(v.observed_start_at, null);
  assert.equal(v.dwell_seconds, null);
  const open = event(4, "ENTER", 200),
    close = event(3, "EXIT", 300);
  await rpc(db, "ingest_geofence_batch", [[open, close], []]);
  v = (await db.query("select * from visits where id=$1", [open.event_id]))
    .rows[0];
  assert.equal(v.quality_reason, "CLOCK_REVIEW");
  assert.equal(v.dwell_seconds, null);
  const incomplete = event(5, "ENTER", 400);
  await rpc(db, "ingest_geofence_batch", [[incomplete], []]);
  await rpc(db, "ingest_geofence_batch", [
    [],
    [
      {
        session_id: session.id,
        observed_end_at: new Date(
          Date.parse(incomplete.observed_at) + 1000,
        ).toISOString(),
        reason: "paused",
      },
    ],
  ]);
  v = (
    await db.query("select * from visits where id=$1", [incomplete.event_id])
  ).rows[0];
  assert.equal(v.status, "interrupted");
  assert.equal(v.dwell_seconds, null);
  assert.equal(v.observed_end_at, null);
});
test("all upload permutations yield identical stable visit identities and durations", async (t) => {
  const db = await paired();
  t.after(() => db.close());
  const { event } = await captureSetup(db);
  const stream = [
    event(1, "EXIT", 0, true),
    event(2, "ENTER", 60),
    event(3, "ENTER", 70),
    event(4, "EXIT", 120),
  ];
  let expected;
  for (const indices of [
    [0, 1, 2, 3],
    [3, 2, 1, 0],
    [1, 3, 0, 2],
    [2, 0, 3, 1],
  ]) {
    await db.exec("reset role");
    await db.exec("delete from visits;delete from geofence_events");
    await actor(db, A);
    for (const i of indices)
      await rpc(db, "ingest_geofence_batch", [[stream[i]], []]);
    const rows = (
      await db.query(
        "select id,stable_visit_key,observed_start_at,observed_end_at,dwell_seconds,status from visits order by id",
      )
    ).rows;
    if (expected) assert.deepEqual(rows, expected);
    else expected = rows;
  }
  assert.equal(expected[0].dwell_seconds, 60);
});
test("immutable revisions, place cap, consent, owner fields and exact grants", async (t) => {
  const db = await paired();
  t.after(() => db.close());
  const { place, device } = await captureSetup(db);
  await assert.rejects(
    db.query("update places set latitude=1 where id=$1", [place.id]),
    /permission denied/,
  );
  for (let i = 0; i < 9; i++)
    await rpc(db, "save_my_place", [
      {
        label: "Synthetic " + i,
        category: "custom",
        latitude: 0,
        longitude: 0,
        radius_m: 75,
      },
    ]);
  await assert.rejects(
    rpc(db, "save_my_place", [
      {
        label: "Over cap",
        category: "custom",
        latitude: 0,
        longitude: 0,
        radius_m: 75,
      },
    ]),
    /PLACE_LIMIT/,
  );
  const revision = await rpc(db, "save_my_place", [
    {
      place_key: place.place_key,
      label: "Revised",
      category: "work",
      latitude: 0,
      longitude: 0,
      radius_m: 400,
    },
  ]);
  assert.equal(revision.revision, 2);
  assert.notEqual(revision.id, place.id);
  await assert.rejects(
    rpc(db, "update_my_settings", [{ user_id: B }]),
    /INVALID_INPUT/,
  );
  await assert.rejects(
    rpc(db, "update_my_settings", [{ display_timezone: "not a timezone" }]),
    /INVALID_INPUT/,
  );
  await rpc(db, "update_my_settings", [{ collection_consent: false }]);
  await assert.rejects(
    rpc(db, "begin_capture", [device.id]),
    /CONSENT_REQUIRED/,
  );
  await assert.rejects(
    rpc(db, "record_my_diagnostic", ["UPLOAD_ERROR", "private data"]),
    /INVALID_INPUT/,
  );
  await rpc(db, "record_my_diagnostic", ["UPLOAD_ERROR", null]);
  await db.exec("reset role");
  const exposed = (
    await db.query(
      "select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and has_function_privilege('anon',p.oid,'EXECUTE')",
    )
  ).rows;
  assert.deepEqual(exposed, []);
  const internal = (
    await db.query(
      "select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and has_function_privilege('authenticated',p.oid,'EXECUTE') order by p.proname",
    )
  ).rows.map((r) => r.proname);
  assert.deepEqual(internal, ["is_allowed", "is_current_peer"]);
  assert.equal(
    (
      await db.query(
        "select count(*) n from pg_tables where schemaname='public' and not rowsecurity",
      )
    ).rows[0].n,
    0,
  );
});
test("invite expiry, rotation, one live pair and removed allowlist revoke access", async (t) => {
  const db = await fresh();
  t.after(() => db.close());
  await actor(db, A);
  const first = await rpc(db, "create_pair_invite");
  const second = await rpc(db, "create_pair_invite");
  await actor(db, B);
  assert.equal(
    (await rpc(db, "create_pair_invite")).code,
    "PAIR_ALREADY_EXISTS",
  );
  assert.equal(
    (await rpc(db, "join_pair", [first.invite_code])).code,
    "INVALID_OR_EXPIRED_CODE",
  );
  await db.exec("reset role");
  await db.exec(
    "update private.pair_invites set expires_at=now()-interval '1 second'",
  );
  await actor(db, B);
  assert.equal(
    (await rpc(db, "join_pair", [second.invite_code])).code,
    "INVALID_OR_EXPIRED_CODE",
  );
  await actor(db, A);
  const third = await rpc(db, "create_pair_invite");
  await actor(db, B);
  assert.equal((await rpc(db, "join_pair", [third.invite_code])).code, "OK");
  await db.exec("reset role");
  await assert.rejects(
    db.query("insert into pairs(user_a,status) values($1,'pending')", [A]),
  );
  await db.query("delete from private.allowed_users where user_id=$1", [A]);
  await actor(db, A);
  await assert.rejects(rpc(db, "get_my_setup_state"), /NOT_ALLOWLISTED/);
  assert.equal((await db.query("select * from places")).rows.length, 0);
  await actor(db, C);
  assert.equal((await db.query("select * from pairs")).rows.length, 0);
});
test("foreign session/device references, oversized batches, old evidence and ID collisions reject", async (t) => {
  const db = await paired();
  t.after(() => db.close());
  const { event } = await captureSetup(db);
  const e = event(1, "EXIT", 0, true);
  await assert.rejects(
    rpc(db, "ingest_geofence_batch", [Array(26).fill(e), []]),
    /INVALID_INPUT/,
  );
  for (const change of [
    { device_id: randomUUID() },
    { session_id: randomUUID() },
    { place_id: randomUUID() },
  ])
    assert.equal(
      (await rpc(db, "ingest_geofence_batch", [[{ ...e, ...change }], []]))
        .rejected[0].code,
      "NOT_OWNER",
    );
  assert.equal(
    (
      await rpc(db, "ingest_geofence_batch", [
        [
          {
            ...e,
            observed_at: new Date(Date.now() - 31 * 86400000).toISOString(),
          },
        ],
        [],
      ])
    ).rejected[0].code,
    "RETENTION_EXPIRED",
  );
  await rpc(db, "ingest_geofence_batch", [[e], []]);
  assert.equal(
    (await rpc(db, "ingest_geofence_batch", [[{ ...e, kind: "ENTER" }], []]))
      .rejected[0].code,
    "ID_CONFLICT",
  );
});
test("deleting A preserves B private history and removes peer access", async (t) => {
  const db = await paired();
  t.after(() => db.close());
  await actor(db, B);
  const p = await rpc(db, "save_my_place", [
    {
      label: "Synthetic B",
      category: "home",
      latitude: 0,
      longitude: 0,
      radius_m: 150,
    },
  ]);
  await actor(db, A);
  await rpc(db, "delete_my_app_data");
  await actor(db, B);
  assert.equal((await db.query("select id from places")).rows[0].id, p.id);
  assert.equal((await db.query("select * from profiles")).rows.length, 1);
  assert.equal((await db.query("select * from pairs")).rows.length, 0);
});
