# Running identity-service + intake-service

## 1. Databases (pgAdmin)
Create two databases: `identity_db` and `intake_db`.
Run `services/identity-service/sql/init.sql` in identity_db's Query Tool.
Run `services/intake-service/sql/init.sql` in intake_db's Query Tool.

## 2. identity-service (terminal 1)
```bash
cd services/identity-service
npm install
cp .env.example .env      # fill in your local Postgres password + a JWT_SECRET
npm run dev                # runs on http://localhost:4001
```

## 3. intake-service (terminal 2)
```bash
cd services/intake-service
npm install
cp .env.example .env      # same JWT_SECRET as identity-service, above
npm run dev                # runs on http://localhost:4002
```

## 4. Frontend (terminal 3)
```bash
cd client
cp .env.example .env
npm run dev                 # http://localhost:5173
```

## 5. Test the distributed call directly

With both services running, register an org handler (role=organisation, orgId=1),
then hit intake-service directly to prove the two services are actually talking:

```bash
curl -X POST http://localhost:4002/reports \
  -H "Authorization: Bearer <token from login>" \
  -H "Content-Type: application/json" \
  -d '{"type":"internal","orgId":1,"description":"Test report","isAnonymous":false}'
```

Check the response's `org_status_verified` field — `true` means intake-service
successfully called identity-service and got "approved" back. To see the
fail-open path, stop identity-service (Ctrl+C in terminal 1), submit again,
and watch `org_status_verified` come back `false` while the report still
gets created — that's the fail-open behavior working as designed.
