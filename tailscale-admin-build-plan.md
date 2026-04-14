# Tailscale Admin Management — Comprehensive Build Plan

## Kisaes Product Suite: Vibe MyBooks & Vibe Trial Balance

**Version:** 1.1
**Date:** April 13, 2026
**Author:** Kisaes LLC / KisaesDevLab
**Status:** Planning

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Shared Module Design](#3-shared-module-design)
4. [Database Schema](#4-database-schema)
5. [Backend API Specification](#5-backend-api-specification)
6. [Frontend Components](#6-frontend-components)
7. [Docker & Infrastructure](#7-docker--infrastructure)
8. [Security Model](#8-security-model)
9. [Phase 1 — Local Device Status & Control](#9-phase-1--local-device-status--control)
10. [Phase 2 — Network Diagnostics & Health Monitoring](#10-phase-2--network-diagnostics--health-monitoring)
11. [Phase 3 — Audit Logging](#11-phase-3--audit-logging)
12. [Testing Strategy](#12-testing-strategy)
13. [Rollout Plan](#13-rollout-plan)
14. [Appendix A — Tailscale CLI & Local API Reference](#14-appendix-a--tailscale-cli--local-api-reference)
15. [Appendix B — Error Codes & Handling](#15-appendix-b--error-codes--handling)
16. [Appendix C — Environment Variables](#16-appendix-c--environment-variables)

---

## 1. Executive Summary

This plan adds Tailscale network management capabilities to the super-admin interface of both Vibe MyBooks and Vibe Trial Balance. The goal is to give CPA firm administrators full visibility and control over their appliance's Tailscale connectivity without requiring SSH access, terminal knowledge, or direct server interaction.

The implementation uses a shared TypeScript module (`@kisaes/tailscale-admin`) consumed by both applications, ensuring feature parity and a single maintenance surface. The architecture leverages the local `tailscaled` Unix socket and CLI for on-device management — no external Tailscale API keys or cloud dependencies are required.

### Design Principles

- **Appliance-first:** Every feature must work on the self-hosted NucBox M6 / mini-PC deployment model with zero cloud dependencies.
- **Super-admin only:** All Tailscale management surfaces are restricted to the super-admin role. No staff user, bookkeeper, or client-portal user can access these features.
- **Non-destructive defaults:** Read operations are always available. Write operations (connect, disconnect) require confirmation dialogs.
- **Offline resilient:** The admin dashboard must render gracefully when Tailscale is disconnected, showing last-known state and clear reconnection guidance.
- **Shared codebase:** Backend service layer, TypeScript types, and React components are published as an internal package used by both apps.

---

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                     Host Machine (Ubuntu Server 24.04)       │
│                                                              │
│  ┌────────────┐   Unix Socket    ┌─────────────────────┐    │
│  │ tailscaled │◄────────────────►│ /var/run/tailscale/  │    │
│  │  (systemd) │                  │  tailscaled.sock     │    │
│  └────────────┘                  └──────────┬──────────┘    │
│                                             │ volume mount   │
│  ┌──────────────────────────────────────────┼──────────┐    │
│  │              Docker Compose               │          │    │
│  │                                           │          │    │
│  │  ┌─────────────────────────────────────┐  │          │    │
│  │  │  Vibe TB / Vibe MB Backend          │  │          │    │
│  │  │  (Node.js 20 + Express)             │  │          │    │
│  │  │                                     │  │          │    │
│  │  │  ┌───────────────────────────────┐  │  │          │    │
│  │  │  │  @kisaes/tailscale-admin      │  │  │          │    │
│  │  │  │                               │  │  │          │    │
│  │  │  │  TailscaleLocalService        │◄─┼──┘          │    │
│  │  │  │    └─ socket / CLI adapter    │  │             │    │
│  │  │  │                               │  │             │    │
│  │  │  │  TailscaleHealthService       │  │             │    │
│  │  │  │    └─ health aggregation      │  │             │    │
│  │  │  │                               │  │             │    │
│  │  │  │  TailscaleRouter              │  │             │    │
│  │  │  │    └─ Express routes          │  │             │    │
│  │  │  └───────────────────────────────┘  │             │    │
│  │  └─────────────────────────────────────┘             │    │
│  │                                                      │    │
│  │  ┌─────────────┐  ┌──────────────┐                   │    │
│  │  │ PostgreSQL   │  │  Nginx       │                   │    │
│  │  │ (config tbl) │  │  Reverse     │                   │    │
│  │  └─────────────┘  │  Proxy       │                   │    │
│  │                    └──────────────┘                   │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### Integration Surfaces

| Surface | Scope | Auth | Use Case |
|---|---|---|---|
| Local Socket (`tailscaled.sock`) | This device only | None (root/group) | Status, up/down, peer list |
| Tailscale CLI (`tailscale`) | This device only | None (root/group) | Status JSON, diagnostics, bugreport |

---

## 3. Shared Module Design

### Package Structure

```
packages/tailscale-admin/
├── src/
│   ├── index.ts                    # Public API barrel export
│   ├── types/
│   │   ├── tailscale.types.ts      # All TypeScript interfaces
│   │   └── api.types.ts            # Request/response DTOs
│   ├── services/
│   │   ├── TailscaleLocalService.ts    # Local socket/CLI adapter
│   │   └── TailscaleHealthService.ts   # Health check aggregation
│   ├── routes/
│   │   ├── tailscale.router.ts     # Express router (all endpoints)
│   │   └── tailscale.middleware.ts # Super-admin gate middleware
│   ├── utils/
│   │   ├── socket-client.ts        # Unix socket HTTP client
│   │   └── cli-executor.ts         # Safe child_process wrapper
│   └── constants.ts                # Defaults, timeouts, paths
├── package.json
├── tsconfig.json
└── README.md
```

### Consumption Pattern

Both apps mount the shared router in their Express setup:

```typescript
// In Vibe TB or Vibe MB server setup
import { createTailscaleRouter } from '@kisaes/tailscale-admin';

const tailscaleRouter = createTailscaleRouter({
  socketPath: process.env.TAILSCALE_SOCKET_PATH || '/var/run/tailscale/tailscaled.sock',
  cliFallback: true,
  db: knexInstance, // or drizzle instance — adapter pattern
});

app.use('/api/admin/tailscale', requireSuperAdmin, tailscaleRouter);
```

### Database Adapter

Since Vibe TB uses Knex.js and Vibe MB uses Drizzle ORM, the shared module accepts a simple adapter interface:

```typescript
interface TailscaleDBAdapter {
  getConfig(key: string): Promise<string | null>;
  setConfig(key: string, value: string): Promise<void>;
  deleteConfig(key: string): Promise<void>;
  insertAuditLog(entry: TailscaleAuditEntry): Promise<void>;
  getAuditLogs(filters: AuditLogFilters): Promise<TailscaleAuditEntry[]>;
}
```

Each app implements this adapter against its own ORM. The shared module never imports Knex or Drizzle directly.

---

## 4. Database Schema

### Table: `tailscale_config`

Stores preferences and cached state. Shared schema for both apps.

```sql
CREATE TABLE tailscale_config (
  id            SERIAL PRIMARY KEY,
  config_key    VARCHAR(100) NOT NULL UNIQUE,
  config_value  TEXT NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by    INTEGER REFERENCES users(id)
);

-- Seed rows
INSERT INTO tailscale_config (config_key, config_value) VALUES
  ('health_check_interval_seconds', '60'),
  ('cached_device_status', '{}'),
  ('last_health_check_at', '');
```

### Table: `tailscale_audit_log`

Immutable log of all Tailscale admin actions.

```sql
CREATE TABLE tailscale_audit_log (
  id            SERIAL PRIMARY KEY,
  action        VARCHAR(50) NOT NULL,   -- 'connect', 'disconnect', 'config_changed', etc.
  actor_id      INTEGER NOT NULL REFERENCES users(id),
  target        VARCHAR(255),           -- device name, node key, etc.
  details       JSONB DEFAULT '{}',     -- action-specific metadata
  ip_address    INET,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ts_audit_created ON tailscale_audit_log(created_at DESC);
CREATE INDEX idx_ts_audit_action ON tailscale_audit_log(action);
```

### Knex Migration (Vibe TB)

```typescript
// migrations/XXXXXX_create_tailscale_tables.js
exports.up = function(knex) {
  return knex.schema
    .createTable('tailscale_config', (t) => {
      t.increments('id').primary();
      t.string('config_key', 100).notNullable().unique();
      t.text('config_value').notNullable();
      t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      t.integer('updated_by').references('id').inTable('users');
    })
    .createTable('tailscale_audit_log', (t) => {
      t.increments('id').primary();
      t.string('action', 50).notNullable();
      t.integer('actor_id').notNullable().references('id').inTable('users');
      t.string('target', 255);
      t.jsonb('details').defaultTo('{}');
      t.specificType('ip_address', 'inet');
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('tailscale_audit_log')
    .dropTableIfExists('tailscale_config');
};
```

### Drizzle Schema (Vibe MB)

```typescript
// src/db/schema/tailscale.ts
import { pgTable, serial, varchar, text, timestamp,
         integer, jsonb, inet, index } from 'drizzle-orm/pg-core';
import { users } from './users';

export const tailscaleConfig = pgTable('tailscale_config', {
  id: serial('id').primaryKey(),
  configKey: varchar('config_key', { length: 100 }).notNull().unique(),
  configValue: text('config_value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: integer('updated_by').references(() => users.id),
});

export const tailscaleAuditLog = pgTable('tailscale_audit_log', {
  id: serial('id').primaryKey(),
  action: varchar('action', { length: 50 }).notNull(),
  actorId: integer('actor_id').notNull().references(() => users.id),
  target: varchar('target', { length: 255 }),
  details: jsonb('details').default({}),
  ipAddress: inet('ip_address'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  createdIdx: index('idx_ts_audit_created').on(table.createdAt),
  actionIdx: index('idx_ts_audit_action').on(table.action),
}));
```

---

## 5. Backend API Specification

All routes are prefixed with `/api/admin/tailscale` and require super-admin authentication.

### Phase 1 Routes — Local Device

| Method | Path | Description |
|---|---|---|
| `GET` | `/status` | Full device status (state, IPs, hostname, OS, version) |
| `GET` | `/peers` | List all tailnet peers visible to this device |
| `GET` | `/peers/:nodeKey` | Single peer detail |
| `POST` | `/connect` | Bring Tailscale up (`tailscale up`) |
| `POST` | `/disconnect` | Bring Tailscale down (`tailscale down`) |
| `POST` | `/reconnect` | Cycle connection (down then up) |
| `GET` | `/ip` | Current Tailscale IP(s) for this device |
| `GET` | `/version` | Tailscale daemon and CLI versions |

### Phase 2 Routes — Diagnostics

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Aggregated health check (connection, DERP, latency, key expiry) |
| `GET` | `/health/derp` | DERP relay connectivity and latency per region |
| `GET` | `/health/latency` | Peer-to-peer latency measurements |
| `GET` | `/health/netcheck` | Full `tailscale netcheck` results |
| `GET` | `/diagnostics/bugreport` | Generate and return `tailscale bugreport` output |
| `GET` | `/diagnostics/log` | Recent Tailscale log entries (journalctl) |

### Phase 3 Routes — Audit

| Method | Path | Description |
|---|---|---|
| `GET` | `/audit` | Paginated audit log with filters |
| `GET` | `/audit/export` | CSV export of audit log |

### Request/Response Types

```typescript
// ─── Status ─────────────────────────────────────────────────
interface TailscaleStatusResponse {
  state: 'Running' | 'Stopped' | 'NeedsLogin' | 'NeedsMachineAuth' | 'Starting';
  self: TailscaleNode;
  peers: Record<string, TailscaleNode>;
  tailnetName: string;
  magicDNSSuffix: string;
  health: string[];           // warnings from tailscaled
  currentTailscaleIPs: string[];
  version: string;
  updatedAt: string;          // ISO timestamp of when status was fetched
}

interface TailscaleNode {
  id: string;
  publicKey: string;
  hostName: string;
  dnsName: string;
  os: string;
  tailscaleIPs: string[];
  allowedIPs: string[];
  addrs: string[];            // direct connection endpoints
  curAddr: string;            // current active endpoint
  relay: string;              // DERP relay region if relayed
  rxBytes: number;
  txBytes: number;
  created: string;
  lastSeen: string;
  lastHandshake: string;
  online: boolean;
  exitNode: boolean;
  exitNodeOption: boolean;
  active: boolean;
  tags: string[];
  keyExpiry: string;          // empty if key doesn't expire
}

// ─── Health ─────────────────────────────────────────────────
interface TailscaleHealthResponse {
  overall: 'healthy' | 'degraded' | 'critical' | 'disconnected';
  checks: HealthCheck[];
  lastCheckAt: string;
}

interface HealthCheck {
  name: string;               // 'connection', 'derp', 'latency', 'key_expiry', 'version'
  status: 'pass' | 'warn' | 'fail';
  message: string;
  details?: Record<string, unknown>;
}

// ─── Netcheck ───────────────────────────────────────────────
interface NetcheckResponse {
  udp: boolean;
  upnP: boolean;
  pmp: boolean;
  pcp: boolean;
  preferredDERP: number;
  regionLatency: Record<number, { latencyMs: number; regionName: string }>;
  mappingVariesByDestIP: boolean;
  hairPinning: boolean;
  globalV4: string;
  globalV6: string;
}

// ─── Connect/Disconnect ─────────────────────────────────────
interface TailscaleConnectRequest {
  authKey?: string;           // optional pre-auth key
  hostname?: string;          // override hostname
  advertiseRoutes?: string[]; // subnet routes to advertise
  acceptRoutes?: boolean;
  exitNode?: string;          // use a specific exit node
  shields?: boolean;          // --shields-up
}

interface TailscaleActionResponse {
  success: boolean;
  message: string;
  previousState: string;
  newState: string;
  auditLogId: number;
}

// ─── Audit ──────────────────────────────────────────────────
interface TailscaleAuditEntry {
  id: number;
  action: string;
  actorId: number;
  actorName?: string;         // joined from users table
  target: string | null;
  details: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
}

interface AuditLogFilters {
  action?: string;
  actorId?: number;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}
```

---

## 6. Frontend Components

### Component Tree

```
AdminSettings/
└── TailscaleAdmin/                       # Top-level tab/page
    ├── TailscaleStatusCard               # Connection state hero card
    │   ├── ConnectionBadge               # Running/Stopped/NeedsLogin pill
    │   ├── DeviceInfoGrid                # IP, hostname, OS, version
    │   └── ConnectionActions             # Connect/Disconnect/Reconnect buttons
    ├── TailscalePeerList                 # Peer table with search/filter
    │   ├── PeerRow                       # Individual peer with expand
    │   └── PeerDetail                    # Expanded: IPs, latency, handshake, routes
    ├── TailscaleHealthPanel              # Health check dashboard
    │   ├── HealthCheckRow                # Individual check with pass/warn/fail
    │   ├── DERPLatencyMap                # Visual DERP region latencies
    │   └── NetcheckResults               # UDP, UPnP, hairpinning details
    ├── TailscaleDiagnostics              # Log viewer + bugreport
    │   ├── LogViewer                     # Scrollable, filterable log entries
    │   └── BugReportExport               # Generate and download button
    └── TailscaleAuditLog                 # Phase 3: Action history
        ├── AuditTable                    # Paginated log table
        ├── AuditFilters                  # Action type, date range, actor
        └── AuditExport                   # CSV download button
```

### TanStack Query Keys

```typescript
export const tailscaleKeys = {
  all: ['tailscale'] as const,
  status: () => [...tailscaleKeys.all, 'status'] as const,
  peers: () => [...tailscaleKeys.all, 'peers'] as const,
  peer: (key: string) => [...tailscaleKeys.all, 'peers', key] as const,
  health: () => [...tailscaleKeys.all, 'health'] as const,
  netcheck: () => [...tailscaleKeys.all, 'netcheck'] as const,
  derp: () => [...tailscaleKeys.all, 'derp'] as const,
  audit: (filters: AuditLogFilters) => [...tailscaleKeys.all, 'audit', filters] as const,
};
```

### Polling Strategy

```typescript
// Status: poll every 10s when tab is active, 60s when backgrounded
const { data: status } = useQuery({
  queryKey: tailscaleKeys.status(),
  queryFn: () => tailscaleAPI.getStatus(),
  refetchInterval: document.hidden ? 60_000 : 10_000,
});

// Health: poll every 60s
const { data: health } = useQuery({
  queryKey: tailscaleKeys.health(),
  queryFn: () => tailscaleAPI.getHealth(),
  refetchInterval: 60_000,
});

// Peers: poll every 15s
const { data: peers } = useQuery({
  queryKey: tailscaleKeys.peers(),
  queryFn: () => tailscaleAPI.getPeers(),
  refetchInterval: 15_000,
});
```

### Key UI Behaviors

1. **Status Card Color Coding:** Green pulsing dot for Running, red for Stopped, amber for NeedsLogin/NeedsMachineAuth, gray for unreachable.

2. **Connection Actions:** Connect button shows spinner + "Connecting..." state. Disconnect requires confirmation modal: "This will disconnect remote access to this appliance. You must have physical or alternative network access to reconnect. Continue?"

3. **Peer List:** Sortable by name, status, last seen, latency. Online peers show green dot, offline peers show gray with "last seen X ago" tooltip. Direct connections show a green "Direct" badge, relay-only connections show amber "Relayed via [DERP region]".

4. **Health Panel:** Traffic-light system. All pass = green banner. Any warn = amber banner with expandable details. Any fail = red banner. Auto-scrolls to first failing check.

---

## 7. Docker & Infrastructure

### Docker Compose Additions

```yaml
# Added to existing docker-compose.yml for both apps

services:
  backend:
    # ... existing config ...
    volumes:
      - /var/run/tailscale/tailscaled.sock:/var/run/tailscale/tailscaled.sock:ro
    environment:
      - TAILSCALE_SOCKET_PATH=/var/run/tailscale/tailscaled.sock
      - TAILSCALE_CLI_PATH=/usr/bin/tailscale
      - TAILSCALE_HEALTH_CHECK_INTERVAL=60
    # If CLI is needed inside container (alternative to socket-only):
    # Mount tailscale binary or install in Dockerfile
```

### Dockerfile Addition (if CLI approach preferred)

```dockerfile
# Add to existing backend Dockerfile
# Install Tailscale CLI (read-only, no daemon)
RUN curl -fsSL https://tailscale.com/install.sh | sh
# The daemon runs on the host; we only need the CLI binary for status queries
```

### Socket vs CLI Decision Matrix

| Criteria | Socket (HTTP over Unix) | CLI (`child_process`) |
|---|---|---|
| Setup complexity | Lower (just volume mount) | Higher (install CLI in container) |
| Performance | Better (direct HTTP, no fork) | Slightly slower (process spawn) |
| Capability | Full local API | Full CLI surface + bugreport |
| Error handling | HTTP status codes | Exit codes + stderr parsing |
| Security | Socket permissions | Binary permissions |
| **Recommendation** | **Primary** | **Fallback + diagnostics** |

The implementation should prefer the socket for status/connect/disconnect and fall back to CLI for `netcheck`, `bugreport`, and `debug` commands that don't have socket equivalents.

### Socket Client Implementation

```typescript
// packages/tailscale-admin/src/utils/socket-client.ts
import http from 'http';
import { TAILSCALE_SOCKET_PATH } from '../constants';

export async function tailscaleSocketRequest<T>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: unknown
): Promise<T> {
  return new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      socketPath: TAILSCALE_SOCKET_PATH,
      path: `/localapi/v0${path}`,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new TailscaleAPIError(res.statusCode, data));
          return;
        }
        try {
          resolve(JSON.parse(data) as T);
        } catch {
          resolve(data as unknown as T);
        }
      });
    });

    req.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new TailscaleSocketError(
          'Tailscale socket not found. Is tailscaled running on the host?'
        ));
      } else if ((err as NodeJS.ErrnoException).code === 'EACCES') {
        reject(new TailscaleSocketError(
          'Permission denied accessing Tailscale socket. Check container volume mount permissions.'
        ));
      } else {
        reject(err);
      }
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}
```

### CLI Executor Implementation

```typescript
// packages/tailscale-admin/src/utils/cli-executor.ts
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const TAILSCALE_CLI = process.env.TAILSCALE_CLI_PATH || '/usr/bin/tailscale';
const COMMAND_TIMEOUT = 30_000; // 30s

// Allowlisted commands — never pass raw user input to exec
const ALLOWED_COMMANDS = new Set([
  'status', 'up', 'down', 'version', 'netcheck',
  'bugreport', 'debug', 'ip', 'whois', 'ping',
]);

export async function tailscaleCLI(
  command: string,
  args: string[] = [],
  options: { timeout?: number; json?: boolean } = {}
): Promise<string> {
  if (!ALLOWED_COMMANDS.has(command)) {
    throw new Error(`Command '${command}' is not in the allowlist`);
  }

  const fullArgs = [command, ...args];
  if (options.json && ['status', 'netcheck'].includes(command)) {
    fullArgs.push('--json');
  }

  const { stdout, stderr } = await execFileAsync(TAILSCALE_CLI, fullArgs, {
    timeout: options.timeout || COMMAND_TIMEOUT,
    maxBuffer: 5 * 1024 * 1024, // 5MB for bugreport
  });

  if (stderr && !stderr.includes('Warning:')) {
    // Non-warning stderr indicates error
    throw new TailscaleCLIError(command, stderr);
  }

  return stdout;
}

export async function tailscaleCLIJson<T>(
  command: string,
  args: string[] = []
): Promise<T> {
  const output = await tailscaleCLI(command, args, { json: true });
  return JSON.parse(output) as T;
}
```

### Host Preparation Script

```bash
#!/bin/bash
# setup-tailscale-docker-access.sh
# Run on the host machine to enable Docker container access to tailscaled socket

# Ensure tailscale group exists
sudo groupadd -f tailscale

# Add the docker container's mapped user to the tailscale group
# (assumes container runs as UID 1000)
sudo usermod -aG tailscale $(id -un 1000) 2>/dev/null || true

# Set socket permissions
sudo chown root:tailscale /var/run/tailscale/tailscaled.sock
sudo chmod 0660 /var/run/tailscale/tailscaled.sock

# Make permissions persist across restarts via systemd override
sudo mkdir -p /etc/systemd/system/tailscaled.service.d/
cat << 'EOF' | sudo tee /etc/systemd/system/tailscaled.service.d/socket-permissions.conf
[Service]
ExecStartPost=/bin/bash -c 'sleep 1 && chown root:tailscale /var/run/tailscale/tailscaled.sock && chmod 0660 /var/run/tailscale/tailscaled.sock'
EOF

sudo systemctl daemon-reload
sudo systemctl restart tailscaled

echo "✓ Tailscale socket configured for Docker container access"
```

---

## 8. Security Model

### Access Control

| Level | Who | Capabilities |
|---|---|---|
| Super Admin | Firm owner / IT admin | Full Tailscale management |
| Admin | Office manager | View status only (read-only health card on main dashboard) |
| Staff | Bookkeepers, CPAs | No access (Tailscale section hidden) |
| Client Portal | External clients | No access |

### Middleware Implementation

```typescript
// packages/tailscale-admin/src/routes/tailscale.middleware.ts

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const user = req.user; // populated by app's existing auth middleware

  if (!user || user.role !== 'super_admin') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Tailscale management requires super-admin privileges',
    });
  }

  next();
}

// For destructive operations (disconnect)
export function requireConfirmation(req: Request, res: Response, next: NextFunction) {
  const { confirmation } = req.body;

  if (confirmation !== 'CONFIRM') {
    return res.status(400).json({
      error: 'Confirmation required',
      message: 'This action requires confirmation. Send { "confirmation": "CONFIRM" } in the request body.',
    });
  }

  next();
}

// Rate limit: max 10 write operations per minute per user
export function tailscaleWriteRateLimit() {
  const windowMs = 60_000;
  const maxRequests = 10;
  const store = new Map<number, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET') return next();

    const userId = req.user!.id;
    const now = Date.now();
    const entry = store.get(userId);

    if (!entry || now > entry.resetAt) {
      store.set(userId, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= maxRequests) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many Tailscale management requests. Try again in a minute.',
      });
    }

    entry.count++;
    next();
  };
}
```

### Threat Model Considerations

1. **Socket escape:** The socket is mounted read-only (`:ro`). Even with write access, the local API only controls the local Tailscale node, not the host system. Container escape via Tailscale socket is not a known attack vector.

2. **Command injection:** The CLI executor uses `execFile` (not `exec`), an allowlisted command set, and never interpolates user input into command strings. Arguments are passed as array elements.

3. **CSRF on write operations:** All write endpoints require the existing app's CSRF token middleware plus explicit `confirmation` field for destructive operations.

4. **Audit trail:** Every write operation creates an immutable audit log entry before execution, ensuring accountability even if the operation fails.

---

## 9. Phase 1 — Local Device Status & Control

### Scope

Core connectivity management for the local appliance. Zero external dependencies beyond the Tailscale daemon running on the host.

### Service Implementation

```typescript
// packages/tailscale-admin/src/services/TailscaleLocalService.ts

import { tailscaleSocketRequest } from '../utils/socket-client';
import { tailscaleCLI, tailscaleCLIJson } from '../utils/cli-executor';
import type { TailscaleStatusResponse, TailscaleNode } from '../types/tailscale.types';

export class TailscaleLocalService {
  /**
   * Get full device status including peers.
   * Primary: socket. Fallback: CLI.
   */
  async getStatus(): Promise<TailscaleStatusResponse> {
    try {
      const raw = await tailscaleSocketRequest<any>('/status');
      return this.normalizeStatus(raw);
    } catch (socketErr) {
      // Fallback to CLI
      const raw = await tailscaleCLIJson<any>('status');
      return this.normalizeStatus(raw);
    }
  }

  /**
   * Get peer list only (derived from status).
   */
  async getPeers(): Promise<TailscaleNode[]> {
    const status = await this.getStatus();
    return Object.values(status.peers);
  }

  /**
   * Get single peer by node key.
   */
  async getPeer(nodeKey: string): Promise<TailscaleNode | null> {
    const status = await this.getStatus();
    return status.peers[nodeKey] || null;
  }

  /**
   * Bring Tailscale up.
   * Options map to `tailscale up` flags.
   */
  async connect(options: {
    authKey?: string;
    hostname?: string;
    advertiseRoutes?: string[];
    acceptRoutes?: boolean;
    exitNode?: string;
    shieldsUp?: boolean;
  } = {}): Promise<{ success: boolean; message: string }> {
    const args: string[] = [];

    if (options.authKey) args.push(`--authkey=${options.authKey}`);
    if (options.hostname) args.push(`--hostname=${options.hostname}`);
    if (options.advertiseRoutes?.length) {
      args.push(`--advertise-routes=${options.advertiseRoutes.join(',')}`);
    }
    if (options.acceptRoutes) args.push('--accept-routes');
    if (options.exitNode) args.push(`--exit-node=${options.exitNode}`);
    if (options.shieldsUp) args.push('--shields-up');

    try {
      await tailscaleCLI('up', args);
      return { success: true, message: 'Tailscale connected successfully' };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  /**
   * Bring Tailscale down.
   */
  async disconnect(): Promise<{ success: boolean; message: string }> {
    try {
      await tailscaleCLI('down');
      return { success: true, message: 'Tailscale disconnected' };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  /**
   * Get Tailscale version info.
   */
  async getVersion(): Promise<{ cli: string; daemon: string }> {
    const output = await tailscaleCLI('version');
    const lines = output.trim().split('\n');
    return {
      cli: lines[0]?.trim() || 'unknown',
      daemon: lines[1]?.trim() || 'unknown',
    };
  }

  /**
   * Get current Tailscale IPs.
   */
  async getIPs(): Promise<string[]> {
    const output = await tailscaleCLI('ip');
    return output.trim().split('\n').filter(Boolean);
  }

  /**
   * Normalize raw tailscale status JSON into our standard response shape.
   */
  private normalizeStatus(raw: any): TailscaleStatusResponse {
    const self = this.normalizeNode(raw.Self);
    const peers: Record<string, TailscaleNode> = {};

    if (raw.Peer) {
      for (const [key, peer] of Object.entries(raw.Peer)) {
        peers[key] = this.normalizeNode(peer as any);
      }
    }

    return {
      state: raw.BackendState || 'Stopped',
      self,
      peers,
      tailnetName: raw.CurrentTailnet?.Name || '',
      magicDNSSuffix: raw.MagicDNSSuffix || '',
      health: raw.Health || [],
      currentTailscaleIPs: self.tailscaleIPs,
      version: raw.Version || 'unknown',
      updatedAt: new Date().toISOString(),
    };
  }

  private normalizeNode(raw: any): TailscaleNode {
    return {
      id: raw.ID || '',
      publicKey: raw.PublicKey || '',
      hostName: raw.HostName || '',
      dnsName: raw.DNSName || '',
      os: raw.OS || '',
      tailscaleIPs: raw.TailscaleIPs || [],
      allowedIPs: raw.AllowedIPs || [],
      addrs: raw.Addrs || [],
      curAddr: raw.CurAddr || '',
      relay: raw.Relay || '',
      rxBytes: raw.RxBytes || 0,
      txBytes: raw.TxBytes || 0,
      created: raw.Created || '',
      lastSeen: raw.LastSeen || '',
      lastHandshake: raw.LastHandshake || '',
      online: raw.Online || false,
      exitNode: raw.ExitNode || false,
      exitNodeOption: raw.ExitNodeOption || false,
      active: raw.Active || false,
      tags: raw.Tags || [],
      keyExpiry: raw.KeyExpiry || '',
    };
  }
}
```

### Task Breakdown

| # | Task | Estimate | Dependencies |
|---|---|---|---|
| 1.1 | Create `packages/tailscale-admin/` scaffolding, `package.json`, `tsconfig.json` | 1h | — |
| 1.2 | Implement `socket-client.ts` with error handling | 2h | 1.1 |
| 1.3 | Implement `cli-executor.ts` with allowlist and timeout | 2h | 1.1 |
| 1.4 | Implement `TailscaleLocalService` (status, connect, disconnect, IPs, version) | 4h | 1.2, 1.3 |
| 1.5 | Implement `tailscale.router.ts` Phase 1 routes | 3h | 1.4 |
| 1.6 | Implement `tailscale.middleware.ts` (auth, rate limit, confirmation) | 2h | 1.5 |
| 1.7 | Database migration for `tailscale_config` + `tailscale_audit_log` (both ORMs) | 2h | — |
| 1.8 | DB adapter implementation for Knex (Vibe TB) | 1h | 1.7 |
| 1.9 | DB adapter implementation for Drizzle (Vibe MB) | 1h | 1.7 |
| 1.10 | Mount router in Vibe TB Express app | 1h | 1.5, 1.8 |
| 1.11 | Mount router in Vibe MB Express app | 1h | 1.5, 1.9 |
| 1.12 | Docker Compose: add socket volume mount + env vars | 1h | 1.10, 1.11 |
| 1.13 | Host setup script for socket permissions | 1h | 1.12 |
| 1.14 | React: `TailscaleStatusCard` component | 3h | 1.10 or 1.11 |
| 1.15 | React: `ConnectionActions` with confirmation modal | 2h | 1.14 |
| 1.16 | React: `TailscalePeerList` + `PeerRow` + `PeerDetail` | 4h | 1.14 |
| 1.17 | React: TanStack Query hooks + polling setup | 2h | 1.14 |
| 1.18 | Integration testing: socket path scenarios | 2h | 1.12 |
| 1.19 | Integration testing: connect/disconnect cycle | 2h | 1.15 |
| **Total Phase 1** | | **~34h** | |

---

## 10. Phase 2 — Network Diagnostics & Health Monitoring

### Scope

Aggregated health checks, DERP relay analysis, network capability detection, and log viewing. Provides the firm admin with troubleshooting data when connectivity issues arise.

### Service Implementation

```typescript
// packages/tailscale-admin/src/services/TailscaleHealthService.ts

export class TailscaleHealthService {
  constructor(
    private local: TailscaleLocalService,
    private db: TailscaleDBAdapter
  ) {}

  async getHealth(): Promise<TailscaleHealthResponse> {
    const checks: HealthCheck[] = [];

    // 1. Connection state check
    try {
      const status = await this.local.getStatus();
      checks.push({
        name: 'connection',
        status: status.state === 'Running' ? 'pass' : 'fail',
        message: status.state === 'Running'
          ? `Connected as ${status.self.hostName}`
          : `Tailscale is ${status.state}`,
        details: { state: status.state, ips: status.currentTailscaleIPs },
      });

      // 2. Key expiry check
      if (status.self.keyExpiry) {
        const expiry = new Date(status.self.keyExpiry);
        const daysUntil = Math.floor((expiry.getTime() - Date.now()) / 86_400_000);
        const warnThreshold = 14;
        checks.push({
          name: 'key_expiry',
          status: daysUntil < 0 ? 'fail' : daysUntil < warnThreshold ? 'warn' : 'pass',
          message: daysUntil < 0
            ? `Key expired ${Math.abs(daysUntil)} days ago`
            : `Key expires in ${daysUntil} days`,
          details: { expiresAt: status.self.keyExpiry, daysRemaining: daysUntil },
        });
      }

      // 3. Peer connectivity check
      const peers = Object.values(status.peers);
      const onlinePeers = peers.filter(p => p.online);
      const relayedPeers = peers.filter(p => p.online && p.relay);
      checks.push({
        name: 'peers',
        status: onlinePeers.length === 0 ? 'warn' : 'pass',
        message: `${onlinePeers.length}/${peers.length} peers online, ${relayedPeers.length} relayed`,
        details: { total: peers.length, online: onlinePeers.length, relayed: relayedPeers.length },
      });

      // 4. Health warnings from tailscaled itself
      if (status.health.length > 0) {
        checks.push({
          name: 'daemon_warnings',
          status: 'warn',
          message: `${status.health.length} warning(s) from tailscaled`,
          details: { warnings: status.health },
        });
      }

    } catch (err: any) {
      checks.push({
        name: 'connection',
        status: 'fail',
        message: `Cannot reach Tailscale: ${err.message}`,
      });
    }

    // 5. Netcheck (can fail independently)
    try {
      const netcheck = await this.getNetcheck();
      checks.push({
        name: 'network',
        status: netcheck.udp ? 'pass' : 'warn',
        message: netcheck.udp
          ? `UDP available, preferred DERP: ${netcheck.preferredDERP}`
          : 'UDP blocked — all traffic relayed through DERP',
        details: netcheck,
      });
    } catch {
      checks.push({
        name: 'network',
        status: 'warn',
        message: 'Network check unavailable',
      });
    }

    // 6. Version check
    try {
      const version = await this.local.getVersion();
      checks.push({
        name: 'version',
        status: 'pass',
        message: `CLI: ${version.cli}`,
        details: version,
      });
    } catch {
      // non-critical
    }

    // Determine overall status
    const hasFailure = checks.some(c => c.status === 'fail');
    const hasWarning = checks.some(c => c.status === 'warn');
    const isDisconnected = checks.find(c => c.name === 'connection')?.status === 'fail';

    const overall = isDisconnected ? 'disconnected'
      : hasFailure ? 'critical'
      : hasWarning ? 'degraded'
      : 'healthy';

    const result: TailscaleHealthResponse = {
      overall,
      checks,
      lastCheckAt: new Date().toISOString(),
    };

    // Cache last health result
    await this.db.setConfig('cached_health_status', JSON.stringify(result));
    await this.db.setConfig('last_health_check_at', result.lastCheckAt);

    return result;
  }

  async getNetcheck(): Promise<NetcheckResponse> {
    const raw = await tailscaleCLIJson<any>('netcheck');
    return {
      udp: raw.UDP ?? false,
      upnP: raw.UPnP ?? false,
      pmp: raw.PMP ?? false,
      pcp: raw.PCP ?? false,
      preferredDERP: raw.PreferredDERP ?? 0,
      regionLatency: this.normalizeRegionLatency(raw.RegionLatency || {}),
      mappingVariesByDestIP: raw.MappingVariesByDestIP ?? false,
      hairPinning: raw.HairPinning ?? false,
      globalV4: raw.GlobalV4 || '',
      globalV6: raw.GlobalV6 || '',
    };
  }

  async getBugreport(): Promise<string> {
    return tailscaleCLI('bugreport', [], { timeout: 60_000 });
  }

  async getRecentLogs(lines: number = 200): Promise<string[]> {
    // Read from journalctl on the host — requires either:
    // 1. Mounting /run/log/journal into the container
    // 2. Or a sidecar log-shipper writing to a shared volume
    // Fallback: read from a log file if configured
    try {
      const output = await tailscaleCLI('debug', ['log', `--lines=${lines}`]);
      return output.split('\n').filter(Boolean);
    } catch {
      return ['Log retrieval not available in this deployment configuration.'];
    }
  }

  private normalizeRegionLatency(raw: Record<string, number>): NetcheckResponse['regionLatency'] {
    const result: NetcheckResponse['regionLatency'] = {};
    // Tailscale uses region IDs (1=NYC, 2=SFO, etc.)
    const regionNames: Record<number, string> = {
      1: 'New York', 2: 'San Francisco', 3: 'Singapore',
      4: 'Frankfurt', 5: 'Sydney', 6: 'São Paulo',
      7: 'Tokyo', 8: 'London', 9: 'Dallas',
      10: 'Seattle', 11: 'Chicago', 12: 'Denver',
      13: 'Miami', 14: 'Toronto', 15: 'Bangalore',
      16: 'Johannesburg', 17: 'Hong Kong', 18: 'Warsaw',
      19: 'Amsterdam', 20: 'Paris', 21: 'Dubai',
    };

    for (const [regionId, latencyNs] of Object.entries(raw)) {
      const id = parseInt(regionId, 10);
      result[id] = {
        latencyMs: Math.round((latencyNs as number) / 1_000_000),
        regionName: regionNames[id] || `Region ${id}`,
      };
    }
    return result;
  }
}
```

### Task Breakdown

| # | Task | Estimate | Dependencies |
|---|---|---|---|
| 2.1 | Implement `TailscaleHealthService` (aggregated health checks) | 4h | Phase 1 |
| 2.2 | Add netcheck, bugreport, log routes to router | 2h | 2.1 |
| 2.3 | React: `TailscaleHealthPanel` with traffic-light system | 3h | 2.2 |
| 2.4 | React: `HealthCheckRow` component with expandable details | 2h | 2.3 |
| 2.5 | React: `DERPLatencyMap` — visual region latency display | 4h | 2.3 |
| 2.6 | React: `NetcheckResults` — UDP, UPnP, hairpinning display | 2h | 2.3 |
| 2.7 | React: `TailscaleDiagnostics` — log viewer + bugreport | 3h | 2.2 |
| 2.8 | Background health check scheduler (setInterval in service) | 2h | 2.1 |
| 2.9 | Cache last-known health state in `tailscale_config` | 1h | 2.8 |
| **Total Phase 2** | | **~23h** | |

---

## 11. Phase 3 — Audit Logging

### Scope

Immutable audit trail of all Tailscale administrative actions. Supports compliance requirements for CPA firms that need to demonstrate network access controls.

### Logged Actions

| Action | Trigger |
|---|---|
| `connect` | Tailscale brought up |
| `disconnect` | Tailscale brought down |
| `reconnect` | Disconnect + connect cycle |
| `config_changed` | Any `tailscale_config` row updated |

### Implementation

Every write operation in the router passes through an audit wrapper:

```typescript
async function withAudit(
  db: TailscaleDBAdapter,
  req: Request,
  action: string,
  target: string | null,
  details: Record<string, unknown>,
  operation: () => Promise<any>
): Promise<any> {
  const entry: TailscaleAuditEntry = {
    id: 0, // auto-increment
    action,
    actorId: req.user!.id,
    target,
    details,
    ipAddress: req.ip || null,
    createdAt: new Date().toISOString(),
  };

  // Log before execution (attempt is auditable even if it fails)
  const logId = await db.insertAuditLog(entry);

  try {
    const result = await operation();
    // Update with success status
    return result;
  } catch (err) {
    // Update log entry with failure
    await db.insertAuditLog({
      ...entry,
      action: `${action}_failed`,
      details: { ...details, error: (err as Error).message },
    });
    throw err;
  }
}
```

### Task Breakdown

| # | Task | Estimate | Dependencies |
|---|---|---|---|
| 3.1 | Audit wrapper utility function | 2h | Phase 1 |
| 3.2 | Integrate audit calls into all write routes | 3h | 3.1 |
| 3.3 | Audit query routes (paginated, filtered, CSV export) | 2h | 3.1 |
| 3.4 | React: `TailscaleAuditLog` — table + filters | 3h | 3.3 |
| 3.5 | React: `AuditExport` — CSV download | 1h | 3.4 |
| **Total Phase 3** | | **~11h** | |

---

## 12. Testing Strategy

### Unit Tests

- `TailscaleLocalService`: Mock `socket-client` and `cli-executor`, test normalization logic, error handling for socket not found / permission denied.
- `TailscaleHealthService`: Mock `TailscaleLocalService`, test health aggregation logic, overall status computation.

### Integration Tests

- **Docker smoke test:** Build container, mount mock socket, verify `/api/admin/tailscale/status` returns expected shape.
- **Auth gate:** Verify non-super-admin gets 403 on all routes.
- **Rate limit:** Verify 11th write request in 60s window returns 429.
- **Audit trail:** Verify connect/disconnect operations create audit log entries.

### Manual Test Scenarios

| Scenario | Steps | Expected Result |
|---|---|---|
| Fresh install, no Tailscale | Access admin page | Graceful "Tailscale not detected" message with setup instructions |
| Tailscale stopped | Access admin page | Red status, connect button available |
| Tailscale running | Access admin page | Green status, device info, peer list |
| Disconnect while remote | Click disconnect via Tailscale IP | Confirmation modal warns about losing remote access |
| Socket permission denied | Container without correct group | Clear error: "Permission denied accessing Tailscale socket" |

---

## 13. Rollout Plan

### Prerequisites (Before Phase 1)

- [ ] Tailscale installed and running on the NucBox M6 host
- [ ] Socket permissions configured via host setup script
- [ ] Super-admin role exists in both app user systems

### Phase Sequencing

```
Phase 1 (Local Status & Control)     ████████████  Week 1-2
Phase 3 (Audit Logging)              ████          Week 2 (parallel)
Phase 2 (Health & Diagnostics)       ████████      Week 3-4
```

### Total Estimated Effort

| Phase | Hours |
|---|---|
| Phase 1 — Local Status & Control | 34h |
| Phase 2 — Diagnostics & Health | 23h |
| Phase 3 — Audit Logging | 11h |
| **Total** | **~68h** |

---

## 14. Appendix A — Tailscale CLI & Local API Reference

### Local API Endpoints (via Unix socket)

| Endpoint | Method | Description |
|---|---|---|
| `/localapi/v0/status` | GET | Device and peer status |
| `/localapi/v0/prefs` | GET | Current preferences |
| `/localapi/v0/check-prefs` | POST | Validate pref changes |
| `/localapi/v0/up` | POST | Connect (like `tailscale up`) |
| `/localapi/v0/down` | POST | Disconnect |
| `/localapi/v0/logout` | POST | Log out of tailnet |
| `/localapi/v0/bugreport` | POST | Generate bug report |
| `/localapi/v0/whois?addr=<ip>` | GET | Look up peer by IP |

### CLI Commands Used

| Command | Purpose |
|---|---|
| `tailscale status --json` | Full status with peer details |
| `tailscale up [flags]` | Connect with options |
| `tailscale down` | Disconnect |
| `tailscale ip` | Show Tailscale IPs |
| `tailscale version` | CLI and daemon version |
| `tailscale netcheck --json` | Network capability check |
| `tailscale bugreport` | Diagnostic bundle |
| `tailscale ping <host>` | Peer connectivity test |
| `tailscale whois <ip>` | Reverse lookup |

---

## 15. Appendix B — Error Codes & Handling

| Error | Source | User Message | Recovery |
|---|---|---|---|
| `ENOENT` on socket | Socket client | "Tailscale is not installed or not running on this server." | Show install instructions |
| `EACCES` on socket | Socket client | "Permission denied. The server needs to be configured to allow Tailscale management." | Link to setup docs |
| `ECONNREFUSED` | Socket client | "Tailscale daemon is not responding." | Suggest restarting tailscaled |
| `timeout` | CLI executor | "Tailscale command timed out." | Retry with backoff |
| `NeedsLogin` | Status response | "This device needs to be re-authenticated with Tailscale." | Show auth URL or key input |
| `NeedsMachineAuth` | Status response | "This device is pending admin approval in the Tailscale admin console." | Link to admin console |

---

## 16. Appendix C — Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `TAILSCALE_SOCKET_PATH` | No | `/var/run/tailscale/tailscaled.sock` | Path to tailscaled Unix socket |
| `TAILSCALE_CLI_PATH` | No | `/usr/bin/tailscale` | Path to Tailscale CLI binary |
| `TAILSCALE_HEALTH_CHECK_INTERVAL` | No | `60` | Seconds between background health checks |
| `TAILSCALE_CLI_TIMEOUT` | No | `30000` | CLI command timeout in milliseconds |
| `TAILSCALE_API_RATE_LIMIT_RPM` | No | `10` | Max write operations per minute per user |

---

*This document is a living spec. Update phase estimates and task breakdowns as implementation progresses. Track completion in the master project plan alongside existing Vibe TB and Vibe MB phase items.*
