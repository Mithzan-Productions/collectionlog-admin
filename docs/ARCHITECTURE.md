# Architecture

## The cast

```
┌─────────────────────────┐         ┌──────────────────────┐
│   Minecraft server      │         │   Website (Vercel)   │
│                         │         │                      │
│  ┌──────────────────┐   │         │  ┌────────────────┐  │
│  │ CollectionLog-   │   │         │  │ Next.js app    │  │
│  │ Reloaded plugin  │   │         │  │ - catalog UI   │  │
│  │                  │   │         │  │ - players UI   │  │
│  │ - LogHolder      │   │         │  │ - grant flow   │  │
│  │ - CollectionMgr  │   │         │  └────────┬───────┘  │
│  └────┬─────────┬───┘   │         │           │          │
│       │         │       │         │           │          │
│       │ depends │       │         │           │          │
│       ▼         │       │         │           │          │
│  ┌──────────────┴───┐   │         │           │          │
│  │ MCPlus plugin    │   │         │           │          │
│  │ - StateService   │   │         │           │          │
│  │ - MessageBus     │◄──┼─────────┼───────────┘          │
│  │   (new)          │   │  Redis  │  publish             │
│  └────┬─────────────┘   │ pub/sub │  envelopes           │
│       │                 │         │                      │
└───────┼─────────────────┘         └──────────┬───────────┘
        │                                      │
        │  reads/writes                        │  reads/writes
        ▼                                      ▼
        ┌────────────────────────────────────────┐
        │  Postgres (on-prem, public)            │
        │                                        │
        │  - player_data (uuid, JSONB, ts)       │  ◄── MCPlus owns
        │  - catalog_collections                 │  ◄── plugin writes,
        │  - catalog_entries (gin_trgm)          │      website reads
        │  - grant_entries() function            │  ◄── website calls
        └────────────────────────────────────────┘
```

## Responsibility split

| Component | Owns |
|---|---|
| **CollectionLogReloaded plugin** | Domain logic (collections, rewards, titles), in-memory `LogHolder` cache for online players, catalog projection writes on startup, MessageBus subscriber for `holder.reload`. |
| **MCPlus plugin** | `player_data` Postgres table, `LogHolder` JSONB serialization through `StateService`, the Redis connection, the typed `MessageBus` layer that both plugins and the website publish/subscribe over. |
| **Website** | All UI. Reads catalog tables for search, reads `player_data` to render holders, calls `grant_entries(...)` to mutate, publishes `holder.reload` after mutation. Stateless — does not maintain a cache. |
| **Postgres** | Source of truth for persistent state. Catalog tables are derived from plugin configs but live here. |
| **Redis** | Pub/sub bus only. Not used for persistence (MCPlus persists to Postgres). |

## Request paths

### Browsing the catalog (read-only)
```
Browser ─► Next.js server action ─► Postgres
            └─ SELECT ... FROM catalog_entries WHERE search_text % $1
```
Fully typed via Drizzle introspection. No plugin involvement.

### Viewing a player
```
Browser ─► Next.js server action ─► Postgres
            └─ SELECT data FROM player_data WHERE uuid = $1
            └─ JSON parsed with generated LogHolder types
```

### Granting items
```
Browser ─► Next.js server action
            ├─ SELECT identifier, collection_id FROM catalog_entries WHERE ...
            ├─ SELECT grant_entries($uuid, 'collectionlog', $entries::jsonb)
            └─ Redis PUBLISH mcplus.collectionlog.holder.reload {uuid, ...}

Plugin (MessageBus subscriber)
            └─ MCPlus reloads LogHolder for $uuid, swaps in-memory cache
```
Atomic at the DB level; safe whether player is online or offline.

## Why not a plugin API

We considered the plugin exposing a REST endpoint and the website calling it. We chose **website-talks-to-DB-directly** because:

1. The MC server's network reachability would be the website's bottleneck (cloudflared, dyndns, etc.). Public Postgres is the same risk surface, simpler.
2. The plugin would need an HTTP server lifecycle to maintain. Postgres already exists.
3. Grant semantics are naturally atomic at the DB level (`FOR UPDATE` + JSONB merge in one function call), and reload-the-cache is a one-line pub/sub message. Splitting that across HTTP would only add latency.

The only reason to introduce a plugin HTTP API would be live operations that can't be expressed as data (kicking a player, running a command). Out of scope for this admin tool.

## Environments

| Env | DB | Redis | Auth |
|---|---|---|---|
| Dev (local) | PGlite (`mock.db` in repo) | No-op stub (logs to console) | NextAuth dev shim (any email) |
| Preview (Vercel PR) | On-prem Postgres, read-only role | No-op stub | NextAuth with Discord OAuth |
| Prod | On-prem Postgres, scoped read-write role | On-prem Redis via MCPlus's bus | NextAuth with Discord OAuth, allowlist of Discord IDs |

Preview previews are intentionally read-only so a leaked URL can't mutate prod data.
