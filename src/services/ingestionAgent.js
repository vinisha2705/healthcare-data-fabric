const pool = require("../config/db");

/**
 * Simulated upstream data sources.
 * In a real system these would be HL7/FHIR feeds, CSV drops, or partner APIs.
 * Each source has its own quirky field names/formats, which is exactly the
 * kind of fragmentation XCaliber's data fabric is meant to unify.
 */
const MOCK_SOURCES = {
  "Apollo EHR": {
    system_type: "FHIR",
    fetchRecords: () => [
      { patientId: "APL-001", name: "Ravi Kumar", dob: "1990-05-12", sex: "M", diagnosis: "Type 2 Diabetes", bg: "B+" },
      { patientId: "APL-002", name: "Sneha Reddy", dob: "1985-11-02", sex: "F", diagnosis: "Hypertension", bg: "O+" },
    ],
  },
  "Fortis Legacy System": {
    system_type: "HL7",
    fetchRecords: () => [
      { id: "FRT-114", full_name: "Amit Verma", birth_date: "1978-02-20", gender: "Male", condition: "Asthma", blood_group: "A+" },
      { id: "FRT-119", full_name: "Priya Nair", birth_date: "1995-07-30", gender: "Female", condition: "Migraine", blood_group: "AB-" },
    ],
  },
  "Clinic CSV Upload": {
    system_type: "CSV_UPLOAD",
    fetchRecords: () => [
      { ref: "CSV-77", Name: "Kabir Singh", DOB: "2000-01-15", Gender: "M", Diagnosis: "Seasonal Allergy", Blood: "B-" },
    ],
  },
};

/**
 * Normalizes a raw record from any known source shape into our canonical
 * patient schema. This is the "agent" logic: it inspects the payload and
 * maps it into a consistent structure regardless of where it came from.
 */
function normalizeRecord(sourceName, raw) {
  switch (sourceName) {
    case "Apollo EHR":
      return {
        external_ref: raw.patientId,
        full_name: raw.name,
        date_of_birth: raw.dob,
        gender: raw.sex === "M" ? "Male" : raw.sex === "F" ? "Female" : raw.sex,
        condition: raw.diagnosis,
        blood_group: raw.bg,
      };
    case "Fortis Legacy System":
      return {
        external_ref: raw.id,
        full_name: raw.full_name,
        date_of_birth: raw.birth_date,
        gender: raw.gender,
        condition: raw.condition,
        blood_group: raw.blood_group,
      };
    case "Clinic CSV Upload":
      return {
        external_ref: raw.ref,
        full_name: raw.Name,
        date_of_birth: raw.DOB,
        gender: raw.Gender === "M" ? "Male" : raw.Gender === "F" ? "Female" : raw.Gender,
        condition: raw.Diagnosis,
        blood_group: raw.Blood,
      };
    default:
      throw new Error(`No normalizer defined for source: ${sourceName}`);
  }
}

async function getOrCreateSource(client, sourceName, systemType) {
  const existing = await client.query("SELECT id FROM sources WHERE name = $1", [sourceName]);
  if (existing.rows.length > 0) return existing.rows[0].id;

  const inserted = await client.query(
    "INSERT INTO sources (name, system_type) VALUES ($1, $2) RETURNING id",
    [sourceName, systemType]
  );
  return inserted.rows[0].id;
}

/**
 * Runs ingestion for a single named source, or all known sources if none is given.
 * Upserts patients by (source_id, external_ref) so re-running ingestion is safe.
 */
async function runIngestion(sourceName = null) {
  const sourcesToRun = sourceName ? [sourceName] : Object.keys(MOCK_SOURCES);
  const results = [];

  for (const name of sourcesToRun) {
    const sourceConfig = MOCK_SOURCES[name];
    if (!sourceConfig) {
      results.push({ source: name, status: "error", notes: "Unknown source" });
      continue;
    }

    const client = await pool.connect();
    let inserted = 0;
    let updated = 0;
    const rawRecords = sourceConfig.fetchRecords();

    try {
      await client.query("BEGIN");
      const sourceId = await getOrCreateSource(client, name, sourceConfig.system_type);

      for (const raw of rawRecords) {
        const normalized = normalizeRecord(name, raw);

        const existing = await client.query(
          "SELECT id FROM patients WHERE source_id = $1 AND external_ref = $2",
          [sourceId, normalized.external_ref]
        );

        if (existing.rows.length > 0) {
          await client.query(
            `UPDATE patients
             SET full_name = $1, date_of_birth = $2, gender = $3, condition = $4,
                 blood_group = $5, raw_payload = $6, updated_at = now()
             WHERE id = $7`,
            [
              normalized.full_name,
              normalized.date_of_birth,
              normalized.gender,
              normalized.condition,
              normalized.blood_group,
              raw,
              existing.rows[0].id,
            ]
          );
          updated += 1;
        } else {
          await client.query(
            `INSERT INTO patients
              (source_id, external_ref, full_name, date_of_birth, gender, condition, blood_group, raw_payload)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              sourceId,
              normalized.external_ref,
              normalized.full_name,
              normalized.date_of_birth,
              normalized.gender,
              normalized.condition,
              normalized.blood_group,
              raw,
            ]
          );
          inserted += 1;
        }
      }

      await client.query(
        `INSERT INTO ingestion_logs (source_id, records_received, records_inserted, records_updated, status)
         VALUES ($1, $2, $3, $4, 'success')`,
        [sourceId, rawRecords.length, inserted, updated]
      );

      await client.query("COMMIT");
      results.push({ source: name, status: "success", received: rawRecords.length, inserted, updated });
    } catch (err) {
      await client.query("ROLLBACK");
      results.push({ source: name, status: "error", notes: err.message });
    } finally {
      client.release();
    }
  }

  return results;
}

function listAvailableSources() {
  return Object.entries(MOCK_SOURCES).map(([name, cfg]) => ({
    name,
    system_type: cfg.system_type,
  }));
}

module.exports = { runIngestion, listAvailableSources };
