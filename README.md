# Healthcare Data Fabric — Mini Backend

A small backend project modeled on XCaliber Health's mission: **unifying fragmented
healthcare data sources into one consistent platform.** It simulates three different
"upstream EHR systems," each with its own messy field names, and runs an ingestion
agent that normalizes their records into one canonical `patients` table exposed via
a secured REST API.

This maps directly to the SDE Intern – Backend JD:
- REST APIs (Express) over PostgreSQL
- Data workflows (multi-source ingestion + normalization + upsert logic)
- Clean, testable, documented code with a clear service/controller/route split
- Auth (JWT + bcrypt) and role-based access
- Dockerized for easy setup (bonus skill in the JD)

## Tech Stack
Node.js, Express, PostgreSQL, JWT auth, Docker & Docker Compose.

## Project Structure
```
healthcare-data-fabric/
├── src/
│   ├── config/          # DB pool + migration runner
│   ├── controllers/      # Request handlers
│   ├── middleware/        # Auth guard, error handler
│   ├── migrations/        # SQL schema
│   ├── routes/             # Express routers
│   ├── services/            # Ingestion "agent" (core data fabric logic)
│   ├── utils/                # JWT helpers
│   └── server.js               # App entrypoint
├── docker-compose.yml
├── Dockerfile
├── package.json
└── .env.example
```

## Option A: Run with Docker (recommended, matches the JD's "cloud platforms" bonus skill)
```bash
cp .env.example .env
docker compose up --build
```
The API will be available at `http://localhost:4000`. Postgres auto-runs
`src/migrations/init.sql` on first boot.

## Option B: Run locally
1. Make sure PostgreSQL is running locally and create a database:
   ```bash
   createdb healthcare_fabric
   ```
2. Copy environment variables:
   ```bash
   cp .env.example .env
   # edit .env if your Postgres credentials differ
   ```
3. Install dependencies and run the migration:
   ```bash
   npm install
   npm run migrate
   ```
4. Start the server:
   ```bash
   npm run dev   # with nodemon
   # or
   npm start
   ```

## API Walkthrough

### 1. Register a user
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Asha Rao","email":"asha@example.com","password":"secret123","role":"admin"}'
```
Save the returned `token` — every other route needs it as
`Authorization: Bearer <token>`.

### 2. See what mock upstream sources exist
```bash
curl http://localhost:4000/api/ingestion/sources \
  -H "Authorization: Bearer <token>"
```

### 3. Run ingestion (pulls from all 3 mock sources, normalizes, upserts)
```bash
curl -X POST http://localhost:4000/api/ingestion/run \
  -H "Authorization: Bearer <token>"
```
Run it again — it will report `updated` counts instead of `inserted`, since
records are matched by `(source, external_ref)`.

### 4. Check ingestion history
```bash
curl http://localhost:4000/api/ingestion/logs \
  -H "Authorization: Bearer <token>"
```

### 5. Query the unified patient table
```bash
curl "http://localhost:4000/api/patients?search=diabetes&page=1&limit=10" \
  -H "Authorization: Bearer <token>"
```

### 6. Full CRUD
- `GET /api/patients/:id`
- `POST /api/patients` — manual entry
- `PATCH /api/patients/:id`
- `DELETE /api/patients/:id` (admin role only)

## Ideas to Extend (good talking points for an interview)
- Swap the mock `fetchRecords()` calls in `services/ingestionAgent.js` for real
  HTTP calls to partner APIs or a FHIR server.
- Add a `node-cron` job to run ingestion automatically every N minutes.
- Add request validation with `zod` or `joi`.
- Add Jest + Supertest tests for the controllers.
- Push ingestion logs to a queue (e.g. RabbitMQ/SQS) so ingestion becomes async
  and horizontally scalable — closer to a real "agentic data fabric."
