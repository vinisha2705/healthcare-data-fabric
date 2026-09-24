const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle PostgreSQL client", err);
  process.exit(1);
});

module.exports = pool;
