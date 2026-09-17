import { writeFile } from "node:fs/promises";
import { fresh } from "../tests/database-harness.mjs";
const db = await fresh();
try {
  const { rows } = await db.query(
    "select table_name,column_name,data_type,is_nullable from information_schema.columns where table_schema='public' order by table_name,ordinal_position",
  );
  let result =
    "// Generated from applied M1 migrations by npm run db:types. Do not edit.\nexport interface DatabaseRows {\n";
  for (const table of [...new Set(rows.map((r) => r.table_name))]) {
    result += `  ${table}: {\n`;
    for (const column of rows.filter((r) => r.table_name === table))
      result += `    ${column.column_name}: ${["integer", "bigint", "smallint", "double precision"].includes(column.data_type) ? "number" : column.data_type === "boolean" ? "boolean" : "string"}${column.is_nullable === "YES" ? " | null" : ""};\n`;
    result += "  };\n";
  }
  result += "}\n";
  await writeFile("src/db/database.generated.ts", result);
} finally {
  await db.close();
}
