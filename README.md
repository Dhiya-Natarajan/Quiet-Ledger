# QuietLedger

**Every case, on record. Every identity, off record.**

A multi-tenant, consent-driven platform for civic safety and workplace misconduct reporting built on a **Distributed Database Management System (DDBMS)** microservices architecture.

---

## Team 9 & Microservice Responsibilities

| Team Member | Roll Number | Microservice / Layer | Core Responsibilities & Contributions |
|---|---|---|---|
| **Aishwarya M Mathapati** | 231CS107 | **Client Layer** (`client`) | React SPA (Vite), responsive UI/UX, role-based dashboards (Citizen, Handler, Admin), interactive Notification Bell, confidential chat interface. |
| **Annabathula Bhavya Sri** | 231CS112 | **Identity Service** (`identity-service`) | `identity_db`, JWT authentication, role-based access control (RBAC), tenant registry (organisations & police stations), admin approval workflows. |
| **Dhiya N** | 231CS121 | **Intake Service** (`intake-service`) | `intake_db`, confidential report intake, tracking tokens, geo-routing, sequential lifecycle state machine, immutable audit logs. |
| **Bukke Lahari** | 231CS217 | **Communication Service** (`communication-service`) | `communication_db`, live Gmail SMTP delivery, 6-digit OTP password reset, login security alerts, break-glass unmasking alerts, WebSocket rooms, delivery retry worker. |

---

## Problem Statement

Civic safety and workplace misconduct reporting are traditionally handled through fragmented, low-trust channels (phone calls, walk-ins, email, spreadsheets). These legacy channels lack end-to-end case tracking, granular access controls, verifiable anonymity guarantees, and automated notifications—causing victims and whistleblowers to remain silent out of fear of retaliation.

QuietLedger addresses this gap with a consent-driven, DDBMS-backed architecture where anonymity is selected per-report, communication remains strictly confidential, and unmasking is governed by cryptographically audited emergency protocols.

---

## Key Features

- **Dual-Track Case Intake:**
  - **Internal Whistleblowing:** Workplace harassment, corruption, and misconduct complaints routed to verified Organisation HR & Compliance teams.
  - **External Incidents:** Public safety emergencies auto-routed to the nearest Police Station based on geographic coordinates (Haversine distance).
- **Consent-Driven Anonymity & Tracking Tokens:**
  - Anonymity is elected per report (`is_anonymous: true`), not per account.
  - Generates a cryptographically secure tracking token (e.g., `#6ecd33b9`) allowing reporters to follow up without disclosing identity.
  - Automatically scrubs personal identifiers (`reporter: null, reporter_id: null`) from handler case queues.
- **Two-Way Confidential Chat:**
  - Real-time message exchange between citizen reporter and assigned handler.
  - Parties are addressed strictly by tracking token when anonymous, preventing identity leaks during investigation.
- **Sequential Lifecycle State Machine:**
  - Strictly enforces valid report status transitions: `submitted` $\rightarrow$ `under_review` $\rightarrow$ `resolved` / `closed`.
- **Emergency Break-Glass Protocol:**
  - Allows Platform Admins to unseal an anonymous reporter's identity only under verified emergency or legal necessity.
  - Unmasks citizen details (**Full Name**, **Email**, **Phone**, **Role**) in the assigned handler's dashboard and case queue.
  - Dispatches an official **Emergency Break-Glass Disclosure Email** to the organisation's or police station's official email address.
  - Records an immutable record in `audit_log`.
- **Real-Time Notification & Email Engine:**
  - **Security Login Alerts:** Automated emails sent directly to registered inboxes on every successful login.
  - **Forgot Password with 6-Digit Email OTP:** 15-minute verification code sent to user email to reset passwords.
  - **Case Assignment & Status Alerts:** Real-time in-app badges and emails on case assignment and status transitions.
  - **Live Gmail SMTP Delivery:** Outbound delivery via Google SMTP (`smtp.gmail.com:587` STARTTLS) with Ethereal sandbox fallback.
  - **Interactive Notification Center:** Header bell with live badge count, unread filter, and instant mark-as-read.
- **Unlisted Entity Request & Approval:**
  - Users can request unlisted organisations or police stations, which enter `pending` status until reviewed and approved by an Admin.

---

## Microservices Topology & Database Boundaries

QuietLedger strictly enforces **Microservice Database Autonomy** (Database-per-Service Pattern). Each microservice owns its independent database instance and schema. Services communicate exclusively via REST APIs, WebSockets, and Event Streams—never through shared SQL tables or cross-service database locks.

```mermaid
flowchart TD
    subgraph Client ["Client Layer (Port 5173)"]
        UI["React SPA (Vite)\n+ Notification Bell + Real-Time Chat"]
    end

    subgraph CoreServices ["Microservices Cluster"]
        IS["Identity Service\n[Port 4001]\nNode.js / Express"]
        TS["Intake Service\n[Port 4002]\nNode.js / Express"]
        CS["Communication Service\n[Port 4003]\nNode.js / Express / TypeScript"]
    end

    subgraph DistributedDBs ["Distributed Database Tier (DDBMS)"]
        IDB[("identity_db\n(PostgreSQL:5432)")]
        TDB[("intake_db\n(PostgreSQL:5432)")]
        CDB[("communication_db\n(PostgreSQL:5432)")]
    end

    UI -->|"Auth & Tenant APIs"| IS
    UI -->|"Case Intake & Chat APIs"| TS
    UI -->|"Notifications & Feed APIs"| CS

    IS <-->|"R/W Schema"| IDB
    TS <-->|"R/W Schema"| TDB
    CS <-->|"R/W Schema (Prisma ORM)"| CDB

    TS -->|"Internal Org/Station Check"| IS
    TS -->|"REST: Alert / Email / SMS"| CS
    IS -->|"REST: Login / OTP Emails"| CS
```

---

## Microservice Database Ownership Matrix

| Microservice | Port | Database | Primary Entities Owned | Technology Stack | Responsibility |
|---|---|---|---|---|---|
| **Identity Service** (`identity-service`) | `4001` | `identity_db` | `users`, `organisations`, `police_stations` | Node.js, Express, PostgreSQL, pg, bcrypt, JWT | User registration, authentication, password reset OTP, tenant registry, admin approval. |
| **Intake Service** (`intake-service`) | `4002` | `intake_db` | `reports`, `report_messages`, `audit_log` | Node.js, Express, PostgreSQL, pg, Axios, Crypto | Confidential report intake, tracking tokens, handler case queues, lifecycle state machine, break-glass unmasking. |
| **Communication Service** (`communication-service`) | `4003` | `communication_db` | `notifications`, `messages`, `conversations`, `delivery_logs`, `notification_preferences` | Node.js, TypeScript, Prisma ORM, Nodemailer, Twilio, Socket.IO | In-app alerts, live Gmail SMTP delivery, SMS dispatch, WebSocket rooms, delivery retry worker. |

---

## Core DDBMS Principles in QuietLedger

### 1. Database Autonomy & Zero Cross-Database Foreign Keys
- `identity_db`, `intake_db`, and `communication_db` are separate, autonomous databases.
- Direct cross-database SQL joins and foreign keys are strictly prohibited.
- Relational fields across service boundaries (e.g. `reporter_id`, `org_id`, `station_id`, `report_id`) are stored as decoupled scalar IDs, preserving microservice boundaries.

### 2. Application-Level Referential Integrity
- Cross-domain validation is performed dynamically via inter-service REST clients (`/internal/organisations/:id/status`, `/internal/users/:id`).

### 3. Fail-Open Distributed Fault Tolerance
```mermaid
sequenceDiagram
    autonumber
    actor Citizen as Citizen / Whistleblower
    participant Intake as Intake Service (Port 4002)
    participant Identity as Identity Service (Port 4001)
    participant Comms as Communication Service (Port 4003)
    participant DB as intake_db

    Citizen->>Intake: POST /reports (Submit Case)
    Intake->>Identity: GET /internal/organisations/:id/status
    
    alt Identity Service Active
        Identity-->>Intake: 200 OK { status: "approved" }
        Intake->>DB: INSERT report (org_status_verified = true)
    else Network Partition / Identity Offline
        Note over Intake: Fail-Open Resilience Strategy
        Intake->>DB: INSERT report (org_status_verified = false)
    end

    Intake->>Comms: POST /notifications & POST /messages/email
    alt Communication Service Active
        Comms-->>Intake: 200 OK (Dispatched)
    else Communication Service Offline
        Note over Intake: Distributed Fail-Open Logging
        Intake-->>Citizen: 201 Created (Case Saved Successfully)
    end
    Intake-->>Citizen: 201 Created
```
- If a downstream service is slow or unreachable, `intake-service` and `identity-service` fail-open with local graceful degradation, ensuring reporting and authentication are never blocked.

### 4. Zero-Knowledge Identity Protection & Break-Glass Unmasking
- Personal identity data (`email`, `password_hash`, `phone_number`) is strictly confined to `identity_db`.
- Anonymous reports shield identity (`reporter: null, reporter_id: null`) from handler queues.
- Only an authorized Platform Admin can execute a logged **Break-Glass Emergency Protocol**, which unseals citizen details to the assigned police or organisation handler across the dashboard, in-app alerts, and official emergency disclosure email.

---

## Database Schemas

### 1. `identity_db` (Owned by `identity-service`)
```sql
CREATE TYPE role AS ENUM ('citizen', 'organisation', 'police', 'platform_admin');
CREATE TYPE tenant_status AS ENUM ('pending', 'approved');

CREATE TABLE organisations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  requested_by_user_id INTEGER,
  status tenant_status NOT NULL DEFAULT 'pending',
  approved_at TIMESTAMP,
  approved_by_user_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE police_stations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  requested_by_user_id INTEGER,
  status tenant_status NOT NULL DEFAULT 'pending',
  approved_at TIMESTAMP,
  approved_by_user_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone_number TEXT,
  password_hash TEXT NOT NULL,
  role role NOT NULL,
  org_id INTEGER REFERENCES organisations(id),
  station_id INTEGER REFERENCES police_stations(id),
  reset_code TEXT,
  reset_expires_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
```

### 2. `intake_db` (Owned by `intake-service`)
```sql
CREATE TABLE reports (
  id SERIAL PRIMARY KEY,
  reporter_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('external', 'internal')),
  org_id INTEGER,
  station_id INTEGER,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  tracking_token TEXT,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'resolved', 'closed')),
  description TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  org_status_verified BOOLEAN NOT NULL DEFAULT false,
  is_unmasked BOOLEAN NOT NULL DEFAULT false,
  break_glass_reason TEXT,
  break_glass_by TEXT,
  break_glass_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE report_messages (
  id SERIAL PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES reports(id),
  sender_user_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  report_id INTEGER,
  actor_user_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
```

### 3. `communication_db` (Owned by `communication-service`)
```prisma
model Notification {
  id        String   @id @default(uuid())
  userId    String   // user:id, org:id, or station:id
  type      String   // IN_APP, STATUS_CHANGED, BREAK_GLASS_ALERT, CASE_ASSIGNED
  title     String
  message   String
  link      String?
  read      Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model DeliveryLog {
  id          String    @id @default(uuid())
  channel     String    // EMAIL, SMS, PUSH
  recipient   String
  subject     String?
  content     String
  status      String    // PENDING, SENT, FAILED, RETRYING
  error       String?
  attempts    Int       @default(0)
  maxAttempts Int       @default(3)
  nextRetryAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model Message {
  id             String       @id @default(uuid())
  conversationId String
  senderId       String
  senderRole     String
  body           String
  isAnonymous    Boolean      @default(false)
  createdAt      DateTime     @default(now())
}
```

---

## REST API Endpoints Matrix

### Identity Service (`http://localhost:4001`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/auth/register` | Register citizen, organisation, or police user | No |
| `POST` | `/auth/login` | Sign in (triggers Security Login Alert email) | No |
| `POST` | `/auth/forgot-password` | Request 6-digit email OTP for password reset | No |
| `POST` | `/auth/reset-password` | Verify 6-digit OTP and reset password | No |
| `GET` | `/auth/me` | Fetch authenticated user profile | Bearer Token |
| `GET` | `/organisations` | List approved organisations | No |
| `GET` | `/police-stations` | List approved police stations | No |
| `POST` | `/organisations/request` | Submit new organisation for admin review | No |
| `POST` | `/police-stations/request` | Submit new police station for admin review | No |
| `GET` | `/admin/organisations` | List all organisations for admin approval | Admin |
| `PATCH` | `/admin/organisations/:id` | Approve or reject organisation | Admin |
| `GET` | `/admin/police-stations` | List all police stations for admin approval | Admin |
| `PATCH` | `/admin/police-stations/:id` | Approve or reject police station | Admin |
| `GET` | `/internal/organisations/:id/status`| Inter-service tenant check | Internal |
| `GET` | `/internal/stations/:id/status`| Inter-service station check | Internal |
| `GET` | `/internal/users/:id` | Inter-service user identity fetch | Internal |

### Intake Service (`http://localhost:4002`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/reports` | Submit a confidential report (Internal / External) | Citizen |
| `GET` | `/reports/my-reports` | List reports filed by logged-in citizen | Citizen |
| `GET` | `/reports/assigned` | List cases assigned to organisation/police handler | Handler / Admin |
| `PATCH` | `/reports/:id/status` | Update case status (triggers alert & email) | Handler / Admin |
| `GET` | `/reports/:id/messages` | Fetch two-way confidential chat thread | Reporter / Handler |
| `POST` | `/reports/:id/messages` | Send message to confidential case thread | Reporter / Handler |
| `POST` | `/reports/:id/break-glass`| Authorize emergency disclosure (unmasks citizen) | Admin |
| `GET` | `/reports/admin/audit-logs`| View immutable audit logs | Admin |

### Communication Service (`http://localhost:4003`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/notifications` | Create and emit real-time in-app notification | Authenticated |
| `GET` | `/notifications` | Fetch notification feed for user or queue | Authenticated |
| `GET` | `/notifications/unread-count` | Get unread badge count | Authenticated |
| `PATCH`| `/notifications/:id/read` | Mark individual notification as read | Authenticated |
| `PATCH`| `/notifications/read-all` | Mark all notifications as read | Authenticated |
| `POST` | `/messages/email` | Dispatch email via Nodemailer (Gmail SMTP / Ethereal) | Authenticated |
| `POST` | `/messages/sms` | Dispatch SMS via Twilio / Mock provider | Authenticated |
| `GET` | `/messages/delivery` | Audit log of all email & SMS delivery attempts | Public / Dev |
| `GET` | `/conversations/:id/messages`| Fetch real-time chat messages by conversation ID | Authenticated |
| `POST` | `/conversations/:id/messages`| Send real-time chat message | Authenticated |

---

## Step-by-Step Evaluation & Demo Guide

### 1. Register & Receive Welcome Email
1. Navigate to `http://localhost:5173/register`.
2. Register as a **Citizen** with your email (e.g. `quietledgersupport@gmail.com`).
3. An automated **Welcome Email** is dispatched via Gmail SMTP.

### 2. Sign In & Receive Security Login Alert Email
1. Navigate to `http://localhost:5173/login`.
2. Sign in with your username/email and password.
3. Check Gmail: a **Security Alert: Successful Login to your Account** arrives in your inbox.

### 3. Forgot Password with 6-Digit Email OTP
1. On the login page, click **Forgot password?**.
2. Enter your email and click **Send Reset Code**.
3. Check Gmail for the **6-digit verification code**.
4. Enter the code and set your new password.
5. Receive password change confirmation email and sign in with the new password.

### 4. File an Anonymous Report
1. On the Citizen Dashboard, choose **Internal Workplace Complaint** or **External Public Incident**.
2. Check **Submit Anonymously**.
3. Submit the case: notice the generated **Tracking Token** (e.g., `#6ecd33b9`).
4. Handler queues immediately receive a **Case Assigned** in-app alert and email notification.

### 5. Two-Way Confidential Chat
1. Open the case details from the Citizen Dashboard.
2. Type a message in the **Confidential Case Thread**.
3. Log in as the Handler: view the message identified only as `From [Anonymous Reporter]`, and reply back.

### 6. Case Status Updates
1. As a Handler, update the report status from `submitted` $\rightarrow$ `under_review` $\rightarrow$ `resolved`.
2. The citizen's **Notification Bell** reflects the update with a badge and sound alert.

### 7. Emergency Break-Glass Unmasking
1. Log in as Platform Admin (`admin@quietledger.org`).
2. Go to **Break-Glass Protocol**, select the anonymous case, and provide a legal justification.
3. Click **Authorize Break Glass**.
4. Log back in as the Handler: the case now displays a **`🚨 Unmasked`** badge and the **🚨 Emergency Break-Glass Unsealed Citizen Identity** card revealing the citizen's real name, email, phone number, and authorization reason!
5. Check `http://localhost:4003/messages/delivery` to inspect the official Emergency Disclosure Email sent to the handler.

---

## Getting Started

### 1. Prerequisites
- **Node.js**: v18 or higher
- **PostgreSQL**: Optional (Services include built-in zero-config in-memory fallback databases for instant zero-downtime execution)

### 2. Environment Setup

#### Communication Service (`services/communication-service/.env`)
```env
PORT=4003
NODE_ENV=development
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/communication_db?schema=public"
JWT_SECRET="quietledger_shared_secret"

# Gmail SMTP Configuration
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="quietledgersupport@gmail.com"
SMTP_PASS="pgdrpzrymeimkjus"
EMAIL_FROM="quietledgersupport@gmail.com"

# SMS Configuration (Twilio / Mock)
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_PHONE_NUMBER=""
ENABLE_MOCK_SMS=true

# Kafka (Optional)
ENABLE_KAFKA=false
```

### 3. Starting the Platform

Run each service in a separate terminal:

```bash
# Terminal 1: Identity Service (Port 4001)
cd services/identity-service
npm start

# Terminal 2: Intake Service (Port 4002)
cd services/intake-service
npm start

# Terminal 3: Communication Service (Port 4003)
cd services/communication-service
npm start

# Terminal 4: React Client (Port 5173)
cd client
npm run dev
```

### 4. Running with Docker Compose (Alternative)
```bash
docker compose up --build
```

### 5. Accessing Endpoints
- **Web Portal**: [http://localhost:5173](http://localhost:5173)
- **Identity API**: [http://localhost:4001/health](http://localhost:4001/health)
- **Intake API**: [http://localhost:4002/health](http://localhost:4002/health)
- **Communication API**: [http://localhost:4003/health](http://localhost:4003/health)
- **Delivery Audit Logs**: [http://localhost:4003/messages/delivery](http://localhost:4003/messages/delivery)
