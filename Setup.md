# Running the Auth Module

## 1. Database — Azure (shared, default)
The team shares one Azure Database for PostgreSQL Flexible Server instead of everyone
running their own local Postgres. Ask whoever set it up for:
- the server hostname (`<server-name>.postgres.database.azure.com`)
- the admin username + password
- confirmation your current IP has been added to the server's firewall rules
  (Azure Portal → your server → Networking → Firewall rules)

You do **not** run `docker compose up` for the database anymore — skip straight to step 2.

### Offline fallback (optional)
If you don't have internet/Azure access, you can still run Postgres locally:
```bash
docker compose up -d
```
then use the commented-out local `DATABASE_URL` in `.env.example` instead of the Azure one.

## 2. Backend
```bash
cd server
npm install
cp .env.example .env      # fill in the Azure DATABASE_URL and set a JWT_SECRET
npx prisma migrate dev --name init
npm run prisma:seed       # creates org id=1 and station id=1 for testing
npm run dev               # runs on http://localhost:4000
```

Everyone on the team runs this same backend locally — only the `DATABASE_URL` in each
person's own `.env` (never committed) points at the shared Azure database, so you're all
reading/writing the same data without needing to sync a local DB.

## 3. Frontend
```bash
cd client
npm create vite@latest . -- --template react   # if not scaffolded yet, choose "Ignore files and continue" if prompted
npm install
npm install axios react-router-dom
# copy src/api, src/context, src/pages, src/App.jsx into the generated src/ folder
npm run dev                # runs on http://localhost:5173
```

## 4. Test it
- Register a citizen: role = citizen, no orgId/stationId needed
- Register an org handler: role = organisation, orgId = 1
- Register a police handler: role = police, stationId = 1
- `GET http://localhost:4000/auth/me` with `Authorization: Bearer <token>` should return the logged-in user