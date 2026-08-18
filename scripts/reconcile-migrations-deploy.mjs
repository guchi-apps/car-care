import { execFileSync } from "node:child_process";

import "dotenv/config";
import mariadb from "mariadb";

import { MIGRATION_REPAIRS } from "./migration-repairs.mjs";

const host = process.env.DB_HOST?.trim() || "127.0.0.1";
const port = Number(process.env.DB_PORT?.trim() || "3306");
const user = process.env.DB_USER?.trim();
const password = process.env.DB_PASSWORD;
const database = process.env.DB_NAME?.trim();

if (!user || password == null || password === "" || !database) {
  console.error("NG: .env に DB_USER / DB_PASSWORD / DB_NAME がありません。");
  process.exit(1);
}

const pool = mariadb.createPool({
  host,
  port,
  user,
  password,
  database,
  connectionLimit: 1,
  connectTimeout: 5000,
});

async function listTableColumns(conn, table) {
  const rows = await conn.query(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
    `,
    [table],
  );

  return new Set(rows.map((row) => row.COLUMN_NAME));
}

async function isMigrationApplied(conn, migrationName) {
  const rows = await conn.query(
    `
      SELECT finished_at
      FROM _prisma_migrations
      WHERE migration_name = ?
      LIMIT 1
    `,
    [migrationName],
  );

  return rows.some((row) => row.finished_at != null);
}

// 適用の途中で失敗し、未完了のまま残った記録をロールバック扱いにする。
//
// **これが残っていると、以降のマイグレーションが一切適用されない**（Prisma の P3018
// 「New migrations cannot be applied before the error is recovered from」）。#91 では
// DDL権限の無いユーザーで `ALTER TABLE` を流して 1142 で落ち、以後どのデプロイも
// 同じ場所で止まる状態になった。
//
// **落ちた時点でDDLは1文も通っていない**（権限エラーはMySQLがステートメントを実行する前に
// 返す）ため、ロールバック扱いにして次の `migrate deploy` で流し直すのが正しい。部分適用が
// 起きうるマイグレーションを足す場合は、この扱いで良いかを個別に見直すこと。
async function rollbackUnfinishedMigrations(conn) {
  const rows = await conn.query(
    `
      SELECT migration_name
      FROM _prisma_migrations
      WHERE finished_at IS NULL AND rolled_back_at IS NULL
    `,
  );

  if (rows.length === 0) {
    return;
  }

  for (const row of rows) {
    console.log(`[${row.migration_name}] 失敗したまま残っていた記録をロールバック扱いにします`);
  }

  await conn.query(
    `
      UPDATE _prisma_migrations
      SET rolled_back_at = NOW()
      WHERE finished_at IS NULL AND rolled_back_at IS NULL
    `,
  );
}

async function reconcileRepair(conn, repair) {
  const existing = await listTableColumns(conn, repair.table);
  const missing = repair.columns.filter((column) => !existing.has(column.name));

  if (missing.length > 0) {
    console.log(
      `[${repair.migration}] 欠けているカラムを追加: ${missing.map((column) => column.name).join(", ")}`,
    );

    for (const column of missing) {
      await conn.query(`ALTER TABLE \`${repair.table}\` ${column.ddl}`);
      existing.add(column.name);
      console.log(`  + ${repair.table}.${column.name}`);
    }
  }

  const allColumnsPresent = repair.columns.every((column) =>
    existing.has(column.name),
  );
  if (!allColumnsPresent) {
    console.log(`[${repair.migration}] カラムが揃っていないためスキップ`);
    return;
  }

  const applied = await isMigrationApplied(conn, repair.migration);
  if (applied) {
    console.log(`[${repair.migration}] 適用済み`);
    return;
  }

  console.log(`[${repair.migration}] スキーマは一致しているため applied に解決します`);
  execFileSync(
    "npx",
    ["prisma", "migrate", "resolve", "--applied", repair.migration],
    { stdio: "inherit" },
  );
}

try {
  const conn = await pool.getConnection();

  try {
    console.log(`Reconciling migrations on ${host}:${port}/${database} ...`);

    await rollbackUnfinishedMigrations(conn);

    for (const repair of MIGRATION_REPAIRS) {
      await reconcileRepair(conn, repair);
    }
  } finally {
    conn.release();
  }

  await pool.end();
  console.log("Migration reconcile complete.");
} catch (error) {
  console.error("NG: migration reconcile failed.");
  if (error instanceof Error) {
    console.error(error.message);
  }
  process.exit(1);
}
