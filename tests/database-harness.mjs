import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFile, readdir } from "node:fs/promises";
export const A = "00000000-0000-4000-8000-000000000001",
  B = "00000000-0000-4000-8000-000000000002",
  C = "00000000-0000-4000-8000-000000000003";
export async function fresh() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema extensions;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
  for (const file of (await readdir("supabase/migrations")).sort())
    await db.exec(await readFile("supabase/migrations/" + file, "utf8"));
  await db.exec(`insert into auth.users values('${A}'),('${B}'),('${C}');insert into private.allowed_users(slot,user_id) values(1,'${A}'),(2,'${B}');
 insert into public.profiles(user_id,display_name) values('${A}','Fixture A'),('${B}','Fixture B');
 insert into public.user_settings(user_id) values('${A}'),('${B}');`);
  return db;
}
export async function actor(db, id) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    id ?? "",
  ]);
  await db.exec("set role " + (id ? "authenticated" : "anon"));
}
export async function rpc(db, name, args = []) {
  return (
    await db.query(
      `select public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) result`,
      args.map((x) =>
        x !== null && typeof x === "object" ? JSON.stringify(x) : x,
      ),
    )
  ).rows[0].result;
}
