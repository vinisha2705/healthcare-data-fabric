const fs = require("fs");
const path = require("path");
const pool = require("./db");

async function runMigration() {
  const sqlPath = path.join(__dirname, "..", "migrations", "init.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");

  try {
    console.log("Running migration...");
    await pool.query(sql);
    console.log("Migration completed successfully.");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runMigration();
