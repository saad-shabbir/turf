import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fresh, actor, rpc, A, B, C } from "./database-harness.mjs";
test("fresh migrations, least privilege, pairing, ownership, replay and deletion", async (t) => {
  const db = await fresh();
  t.after(() => db.close());
  await assert.rejects(
    db.exec(`insert into private.allowed_users values(3,'${C}',now())`),
  );
  await actor(db, C);
  await assert.rejects(rpc(db, "get_my_setup_state"), /NOT_ALLOWLISTED/);
  assert.equal(
    (await db.query("select * from public.profiles")).rows.length,
    0,
  );
  await actor(db, null);
  await assert.rejects(db.query("select * from public.places"));
  await assert.rejects(rpc(db, "get_my_setup_state"));
  await actor(db, A);
  await assert.rejects(
    db.exec(`insert into public.visits(id) values('${randomUUID()}')`),
  );
  await assert.rejects(db.query("select * from private.allowed_users"));
  const invite = await rpc(db, "create_pair_invite");
  assert.match(invite.invite_code, /^[0-9A-F]{6}$/);
  assert.equal(
    (await rpc(db, "join_pair", [invite.invite_code])).code,
    "INVALID_OR_EXPIRED_CODE",
  );
  await actor(db, B);
  for (let i = 0; i < 5; i++)
    assert.equal(
      (await rpc(db, "join_pair", ["invalid"])).code,
      "INVALID_OR_EXPIRED_CODE",
    );
  assert.equal(
    (await rpc(db, "join_pair", [invite.invite_code])).code,
    "RATE_LIMITED",
  );
  await db.exec("reset role");
  assert.equal(
    (
      await db.query(
        `select attempts from private.invite_attempts where user_id='${B}'`,
      )
    ).rows[0].attempts,
    6,
  );
  await db.exec(`delete from private.invite_attempts where user_id='${B}'`);
  await actor(db, B);
  assert.equal((await rpc(db, "join_pair", [invite.invite_code])).code, "OK");
  assert.equal(
    (await rpc(db, "join_pair", [invite.invite_code])).code,
    "INVALID_OR_EXPIRED_CODE",
  );
  assert.equal(
    (await db.query("select * from public.profiles")).rows.length,
    2,
  );
  await actor(db, A);
  await rpc(db, "update_my_settings", [{ collection_consent: true }]);
  const place = await rpc(db, "save_my_place", [
    {
      label: "Synthetic test region",
      category: "gym",
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
  await actor(db, B);
  assert.equal((await db.query("select * from public.places")).rows.length, 0);
  await assert.rejects(rpc(db, "disable_my_place", [place.id]), /NOT_OWNER/);
  await assert.rejects(rpc(db, "begin_capture", [device.id]), /WRONG_DEVICE/);
  await assert.rejects(
    rpc(db, "save_my_place", [
      {
        place_key: place.place_key,
        label: "foreign",
        category: "gym",
        latitude: 0,
        longitude: 0,
        radius_m: 150,
      },
    ]),
    /NOT_OWNER/,
  );
  await actor(db, A);
  const base = Date.parse(session.started_at) + 1;
  const event = (seq, kind, ms, initial = false) => ({
    event_id: randomUUID(),
    platform_event_id: randomUUID(),
    session_id: session.id,
    device_id: device.id,
    place_id: place.id,
    client_seq: seq,
    kind,
    observed_at: new Date(base + ms).toISOString(),
    initial_state_possible: initial,
  });
  const exit = event(1, "EXIT", 0, true),
    enter = event(2, "ENTER", 1000),
    leave = event(3, "EXIT", 61000);
  const first = await rpc(db, "ingest_geofence_batch", [[leave], []]);
  assert.deepEqual(first.accepted, [leave.event_id]);
  assert.equal((await db.query("select * from public.visits")).rows.length, 0);
  await rpc(db, "ingest_geofence_batch", [[exit, enter], []]);
  let visits = (await db.query("select * from public.visits")).rows;
  assert.equal(visits.length, 1);
  assert.equal(visits[0].dwell_seconds, 60);
  assert.equal(visits[0].status, "closed");
  assert.deepEqual(
    (await rpc(db, "ingest_geofence_batch", [[enter], []])).duplicates,
    [enter.event_id],
  );
  assert.equal(
    (await db.query("select * from public.geofence_events")).rows.length,
    3,
  );
  await actor(db, B);
  assert.equal(
    (await db.query("select * from public.geofence_events")).rows.length,
    0,
  );
  assert.equal((await db.query("select * from public.visits")).rows.length, 0);
  assert.equal(
    (await rpc(db, "ingest_geofence_batch", [[enter], []])).rejected[0].code,
    "NOT_OWNER",
  );
  await actor(db, A);
  const duplicateEnter = event(4, "ENTER", 100000),
    again = event(5, "ENTER", 101000),
    end = event(6, "EXIT", 102000);
  await rpc(db, "ingest_geofence_batch", [[duplicateEnter, again, end], []]);
  assert.equal((await db.query("select * from public.visits")).rows.length, 2);
  const skew = event(7, "ENTER", 600000);
  await rpc(db, "ingest_geofence_batch", [[skew], []]);
  assert.equal(
    (
      await db.query(
        "select validation_status from public.geofence_events where id=$1",
        [skew.event_id],
      )
    ).rows[0].validation_status,
    "review",
  );
  await rpc(db, "ingest_geofence_batch", [
    [],
    [
      {
        session_id: session.id,
        observed_end_at: new Date(base + 103000).toISOString(),
        reason: "paused",
      },
    ],
  ]);
  assert.equal(
    (await rpc(db, "ingest_geofence_batch", [[event(8, "ENTER", 104000)], []]))
      .rejected[0].code,
    "STALE_SESSION",
  );
  assert.deepEqual(
    (await rpc(db, "ingest_geofence_batch", [[enter], []])).duplicates,
    [enter.event_id],
  );
  await rpc(db, "claim_device", [randomUUID(), { app: "test", os: "test" }]);
  assert.equal(
    (await rpc(db, "ingest_geofence_batch", [[enter], []])).rejected[0].code,
    "WRONG_DEVICE",
  );
  await rpc(db, "delete_my_app_data");
  assert.equal((await db.query("select * from public.places")).rows.length, 0);
  await actor(db, B);
  assert.equal(
    (await db.query("select * from public.profiles")).rows.length,
    1,
  );
  await db.exec("reset role");
  assert.equal((await db.query("select * from auth.users")).rows.length, 3);
});
