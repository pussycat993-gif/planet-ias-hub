# IAS Hub — Authentication Specification

## Overview

IAS Hub supports two authentication modes:

| Mode | Users | Flow |
|---|---|---|
| SSO | PCI users (internal team, client staff) | JWT token passed from PLANet Contact IAS |
| Standalone | External users (no PCI account) | Email + password, managed in IAS Hub DB |

---

## Mode 1: SSO — PCI Users

### How it works

1. User is logged into PLANet Contact IAS
2. User clicks "Open IAS Hub" button in PCI (People detail or toolbar)
3. PCI generates a short-lived JWT token (15 min TTL) signed with `JWT_SECRET`
4. PCI opens IAS Hub Electron app via deep link: `iashub://auth?token=eyJhbGci...`
5. Electron passes token to Node.js backend: `POST /api/auth/sso`
6. Node.js verifies token with PCI API: `POST /api/ias-connect/auth/verify`
7. PCI returns user profile (id, name, email, role, avatar)
8. IAS Hub creates/updates local user record in PostgreSQL
9. IAS Hub issues its own session token (24h TTL)
10. User is logged in — no password required

### JWT Token Structure (PCI → IAS Hub)

```json
{
  "sub": "102",
  "name": "Ivana Vrtunic",
  "email": "ivana.vrtunic@planetsg.com",
  "role": "admin",
  "tenant": "psg-workgroup",
  "iat": 1711234567,
  "exp": 1711235467
}
```

### Security

- JWT signed with `JWT_SECRET` (same secret in PCI `.env` and IAS Hub `.env`)
- Token TTL: 15 minutes (one-time use for login)
- After login, IAS Hub issues its own session token stored in Electron secure storage
- Token never stored in localStorage or plain files

---

## Mode 2: Standalone — External Users

### How it works

1. Administrator creates external user account in IAS Hub Admin Panel
2. User receives welcome email with temporary password
3. User opens IAS Hub, selects "External login"
4. User enters email + password
5. IAS Hub backend verifies against PostgreSQL (bcrypt)
6. Session token issued (24h TTL)
7. User logged in — no access to PCI data panels

### Password Rules

- Minimum 10 characters
- At least one uppercase, one number, one special character
- bcrypt with cost factor 12
- Password reset via email (SMTP configured per tenant)

---

## Session Management

| Property | Value |
|---|---|
| Session token TTL | 24 hours |
| Storage (Electron) | `electron-store` (encrypted, OS keychain) |
| Refresh | Silent refresh 1h before expiry |
| Logout | Token deleted from store + server-side invalidation |

---

## User Record in PostgreSQL

```sql
CREATE TABLE users (
  id              SERIAL PRIMARY KEY,
  pci_id          INTEGER UNIQUE,        -- NULL for external users
  email           VARCHAR(255) UNIQUE NOT NULL,
  name            VARCHAR(255) NOT NULL,
  avatar_url      TEXT,
  role            VARCHAR(50) DEFAULT 'member',
  user_type       VARCHAR(20) NOT NULL,  -- 'sso' | 'standalone'
  password_hash   TEXT,                  -- NULL for SSO users
  tenant_id       VARCHAR(100) NOT NULL,
  last_seen_at    TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);
```

---

## API Endpoints (IAS Hub Node.js)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/sso` | Verify PCI JWT and create session |
| `POST` | `/api/auth/login` | Standalone email + password login |
| `POST` | `/api/auth/logout` | Invalidate session |
| `GET` | `/api/auth/me` | Return current user profile |
| `POST` | `/api/auth/refresh` | Refresh session token |
| `POST` | `/api/auth/reset-password` | Request password reset (external users) |

---

## PCI Endpoint Required (Laravel)

```
POST /api/ias-connect/auth/verify
Authorization: Bearer {JWT_SECRET}
Body: { "token": "eyJhbGci..." }

Response 200:
{
  "valid": true,
  "user": {
    "id": 102,
    "name": "Ivana Vrtunic",
    "email": "ivana.vrtunic@planetsg.com",
    "role": "admin",
    "avatar": "https://ias-app.planetsg.com/avatars/102.jpg"
  }
}

Response 401:
{
  "valid": false,
  "error": "Token expired or invalid"
}
```

---

## Electron Deep Link

IAS Hub registers the `iashub://` protocol on install.

```
iashub://auth?token=eyJhbGci...
```

Handled in `electron/main.js`:

```js
app.setAsDefaultProtocolClient('iashub');

app.on('open-url', (event, url) => {
  const token = new URL(url).searchParams.get('token');
  mainWindow.webContents.send('auth:sso-token', token);
});
```

---

## Visual Flow in IAS Hub

```
App opens
    │
    ├── Existing session? ──YES──► Load app directly
    │
    NO
    │
    ├── SSO token in URL? ──YES──► POST /api/auth/sso ──► Load app
    │
    NO
    │
    └── Show login screen
            │
            ├── "Sign in with PCI" ──► Opens PCI URL ──► PCI redirects back with token
            │
            └── "External login" ──► Email + password ──► POST /api/auth/login
```
