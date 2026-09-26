# QuietLedger

**Every case, on record. Every identity, off record.**

A multi-tenant, consent-driven platform for civic safety and workplace complaint reporting.


---

## Team 9

- Aishwarya M Mathapati — 231CS107
- Annabathula Bhavya Sri — 231CS112
- Dhiya N — 231CS121
- Bukke Lahari — 231CS217

---

## Problem

Civic safety and workplace misconduct reporting are handled through fragmented, low-trust channels — a phone call, a walk-in, an email, a spreadsheet. There's no case tracking, no access control, and no enforced anonymity: reporters stay silent because "anonymous" isn't actually guaranteed by the system receiving the report.

## What QuietLedger does

- One account per user, two report tracks:
  - **External** — civic/public safety issues, auto-routed to the nearest police station
  - **Internal** — workplace complaints, routed to the reporting org's HR/compliance team
- **Consent-driven anonymity**, decided per report (not per account): the reporter chooses disclosed or anonymous at submission time
- **Multi-tenant isolation** — each organisation's cases and handlers are invisible to every other tenant
- **Break-glass disclosure** — identity can only be un-masked by a Platform Admin, and every instance is logged
- Four roles: Citizen/Employee, Organisation, Police Station, Platform Admin

---

## Architecture

### Target architecture (long-term proposal)

Microservices: Account/Identity, Consent & Disclosure, Intake, Anonymisation, Geo-Routing, Tenant, Case Management, Secure Messaging — built on Spring Boot, Kafka, Redis, PostgreSQL/PostGIS, Mongo/MinIO, with Eureka + Config Server for service discovery, containerised via Docker Compose.

### Initial implementation (what we're actually building first)

To get a working, demoable prototype quickly, we're starting with a **monolith** instead of full microservices:

```
React frontend  →  Express monolith (Auth · Reports · Messaging · Admin)  →  PostgreSQL
```

| Module | Responsibility |
|---|---|
| Auth | Registration/login, JWT with role claims (4 roles) |
| Reports | Report creation, anonymity token issuance, routing (haversine-based nearest-station lookup for external, org selection for internal) |
| Messaging | Two-way report-scoped chat; strips real identity from responses unless the reporter has disclosed |
| Admin | Org/station approval, break-glass disclosure, audit log |

We'll migrate pieces of this into separate services later — see [Future Scope](#future-scope).

---

## Tech stack

- **Backend:** Node.js + Express, PostgreSQL (Prisma ORM)
- **Frontend:** React (Vite)
- **Auth:** JWT
- **Dev tools:** Postman/Insomnia for API testing

## Getting started 

```bash
# will be filled in once the backend scaffold lands
git clone <https://github.com/Dhiya-Natarajan/Quiet-Ledger.git>
cd quietledger
npm install
npm run dev
```

Environment variables, DB migration steps, and seed script instructions will be added here as they're built.

---

## Future Scope

- Split monolith into the originally proposed microservices
- PostGIS for true geospatial routing (replacing haversine)
- Kafka-based event-driven messaging and notifications
- Evidence notarization (hash-chained attachments, tamper-evidence)
- Dedicated Audit & Compliance Analytics service
- Eureka + Config Server, observability (Zipkin, Prometheus, Grafana)
- Second full-featured admin dashboard, UI polish

---

