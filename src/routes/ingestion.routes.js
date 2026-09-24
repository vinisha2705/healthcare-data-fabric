const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middleware/auth");
const {
  listSources,
  triggerIngestion,
  getIngestionLogs,
} = require("../controllers/ingestion.controller");

router.get("/sources", requireAuth, listSources);
router.post("/run", requireAuth, requireRole("admin", "clinician"), triggerIngestion);
router.get("/logs", requireAuth, getIngestionLogs);

module.exports = router;
