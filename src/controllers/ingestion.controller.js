const { runIngestion, listAvailableSources } = require("../services/ingestionAgent");
const pool = require("../config/db");

async function listSources(req, res, next) {
  try {
    res.json({ sources: listAvailableSources() });
  } catch (err) {
    next(err);
  }
}

async function triggerIngestion(req, res, next) {
  try {
    const { source } = req.body; // optional: ingest a single named source
    const results = await runIngestion(source || null);
    res.status(200).json({ results });
  } catch (err) {
    next(err);
  }
}

async function getIngestionLogs(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT il.id, s.name AS source_name, il.records_received, il.records_inserted,
              il.records_updated, il.status, il.created_at
       FROM ingestion_logs il
       LEFT JOIN sources s ON s.id = il.source_id
       ORDER BY il.created_at DESC
       LIMIT 50`
    );
    res.json({ logs: result.rows });
  } catch (err) {
    next(err);
  }
}

module.exports = { listSources, triggerIngestion, getIngestionLogs };
