import { readdir, readFile } from "node:fs/promises"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import pg from "pg"

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationsDir = join(__dirname, "..", "supabase", "migrations")

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error("DATABASE_URL is required to run migrations")
    process.exit(1)
  }

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1")
      ? false
      : { rejectUnauthorized: false },
  })
  await client.connect()

  try {
    await client.query(`
      create table if not exists schema_migrations (
        version text primary key,
        applied_at timestamptz not null default now()
      )
    `)

    const files = (await readdir(migrationsDir))
      .filter((name) => name.endsWith(".sql"))
      .sort()

    if (files.length === 0) {
      console.log("No migration files found")
      return
    }

    const { rows: applied } = await client.query("select version from schema_migrations")
    const appliedVersions = new Set(applied.map((row) => row.version))

    for (const file of files) {
      if (appliedVersions.has(file)) {
        console.log(`Skipping ${file} (already applied)`)
        continue
      }

      const sql = await readFile(join(migrationsDir, file), "utf8")
      console.log(`Applying ${file}...`)

      await client.query("begin")
      try {
        await client.query(sql)
        await client.query("insert into schema_migrations (version) values ($1)", [file])
        await client.query("commit")
        console.log(`Applied ${file}`)
      } catch (error) {
        await client.query("rollback")
        throw error
      }
    }

    console.log("Migrations complete")
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error("Migration failed:", error)
  process.exit(1)
})
