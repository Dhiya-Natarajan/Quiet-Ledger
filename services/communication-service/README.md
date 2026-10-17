# QuietLedger — Communication Microservice

**Dedicated Module Lead:** Bukke Lahari (231CS217)  
**Service Port:** `4003`  
**Database:** `communication_db` (PostgreSQL / Prisma ORM + Zero-Config In-Memory Fallback)

---

## 1. Overview

The **Communication Service** is an autonomous microservice responsible for all asynchronous messaging, event-driven notifications, real-time WebSockets, and external email/SMS communications across the QuietLedger civic safety platform.

Following the **Distributed Database Management System (DDBMS)** database-per-service pattern, this service owns `communication_db` and communicates with `identity-service` (Port 4001) and `intake-service` (Port 4002) exclusively through decoupled REST APIs and Socket.IO rooms.

---

## 2. Key Capabilities

### 📧 Live Gmail SMTP Email Engine
- Authenticated via Google App Passwords over port `587` with STARTTLS.
- Fallback developer sandbox via Nodemailer Ethereal Email (`smtp.ethereal.email`).
- Automated delivery to real personal inboxes (`quietledgersupport@gmail.com`).

### 🔐 Security & Account Notifications
- **Login Security Alert Emails:** Dispatched automatically upon every user login, detailing the timestamp, account role, and security advisory.
- **Welcome Emails:** Delivered upon citizen or handler registration.
- **Forgot Password 6-Digit Email OTP:** Cryptographically secure 15-minute verification code dispatch and password reset confirmations.

### 🚨 Emergency Break-Glass Disclosure
- Dispatches high-priority in-app alerts to Platform Admins and assigned handler queues (`org-<id>`, `station-<id>`).
- Dispatches official **Emergency Break-Glass Disclosure Emails** containing unmasked citizen personal details (Name, Email, Phone, Role) and legal justification to the organization or police station's official contact address.

### 💬 Two-Way Confidential Chat Channel
- Manages confidential case thread messages between citizen reporters and handlers.
- Enforces strict anonymity: parties are addressed by tracking token (`#6ecd33b9`), shielding citizen identity unless break-glass is executed.

### 🔔 Interactive Notification Center
- Real-time Socket.IO rooms (`user:<userId>`, `conversation:<id>`).
- Notification bell component with live unread badge, filterable feed, and instant mark-as-read.

### 🔄 Exponential Backoff Retry Worker
- Background cron worker polling every 30 seconds for failed delivery attempts.
- Automatically retries failed emails and SMS up to 3 times with exponential backoff (`nextRetryAt`).
- Full audit tracking in `delivery_logs` accessible via `GET /messages/delivery`.

---

## 3. Architecture & Data Flow

```mermaid
flowchart TD
    IS["Identity Service\n(Port 4001)"] -->|"POST /messages/email\n(Login Alerts, OTP)"| CS["Communication Service\n(Port 4003)"]
    TS["Intake Service\n(Port 4002)"] -->|"POST /notifications\nPOST /messages/email\n(Status, Break-Glass)"| CS
    UI["React Frontend\n(Port 5173)"] -->|"GET /notifications\nSocket.IO Rooms"| CS

    subgraph InternalEngine ["Communication Internal Architecture"]
        Worker["Background Delivery Worker\n(Exponential Backoff Retries)"]
        Socket["Socket.IO Server\n(Real-Time Rooms)"]
        Mailer["Nodemailer Engine\n(Gmail SMTP / Ethereal)"]
        SMS["Twilio Engine\n(SMS Provider / Mock)"]
    end

    CS --> Worker
    CS --> Socket
    CS --> Mailer
    CS --> SMS

    CS <-->|"Prisma ORM"| DB[("communication_db\n(PostgreSQL:5432)")]
```

---

## 4. Database Schema (`communication_db`)

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

## 5. REST API Reference

### Notifications (`/notifications`)
- `POST /notifications`: Create and broadcast in-app notification.
  ```json
  {
    "userId": "org-1",
    "type": "BREAK_GLASS_ALERT",
    "title": "EMERGENCY CITIZEN UNMASKED",
    "message": "Platform Admin unsealed identity for Report #2"
  }
  ```
- `GET /notifications?userId=org-1`: Fetch notification list for a given user or queue.
- `GET /notifications/unread-count?userId=org-1`: Fetch count of unread notifications.
- `PATCH /notifications/:id/read`: Mark notification as read.
- `PATCH /notifications/read-all`: Mark all notifications as read.

### Messages & Delivery (`/messages`)
- `POST /messages/email`: Send email via Nodemailer.
  ```json
  {
    "to": "quietledgersupport@gmail.com",
    "subject": "[QuietLedger] Security Alert: Successful Login",
    "body": "Your account was logged into on 10/17/2026."
  }
  ```
- `POST /messages/sms`: Dispatch SMS via Twilio or mock provider.
- `GET /messages/delivery`: Audit log of all dispatched emails and SMS records.

---

## 6. Environment Configuration (`.env`)

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

# SMS Configuration (Twilio)
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_PHONE_NUMBER=""
ENABLE_MOCK_SMS=true

# Kafka (Optional)
ENABLE_KAFKA=false
```

---

## 7. Running the Service

```bash
# Navigate to directory
cd services/communication-service

# Install dependencies
npm install

# Compile TypeScript
npm run build

# Start Service
npm start
```
