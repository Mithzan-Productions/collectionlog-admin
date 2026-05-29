# Messaging (MCPlus MessageBus + website integration)

Cache invalidation and live-edit safety depend on a typed pub/sub layer. The plan is to grow this in `mcplus-platform-core` as a new `messaging` module, sitting on top of the existing `redis-core` primitives.

## Why in MCPlus, not in CollectionLogReloaded

- MCPlus already owns the Redis connection (`RedisConnectionFactory`). Two plugins each opening their own Lettuce client is wasted.
- The website needs to publish into the same bus. If pub/sub lives in CLR, the website can't cleanly target other plugins that depend on MCPlus. In MCPlus, every plugin gets it for free.
- The envelope spec becomes a single schema both sides codegen against (see [CONTRACTS.md](CONTRACTS.md)).

## Envelope (the wire shape)

```jsonc
{
  "type":      "holder.reload",        // dot-namespaced event name
  "version":   1,                       // monotonic per type; subscribers skip unknown
  "timestamp": 1735689600000,
  "source":    "collectionlog-admin",   // who sent it (free-form id)
  "payload":   { /* type-specific */ }
}
```

The wire JSON is exactly this object, published as the message body on a Redis channel.

## Channel naming

`mcplus.<plugin>.<event>` — e.g. `mcplus.collectionlog.holder.reload`. Two reasons:
- Pattern subscribes are easy: a plugin can `psubscribe mcplus.collectionlog.*` to grab everything in its namespace.
- Cross-plugin collisions are physically impossible.

The website publishes to the channel the plugin owns; it does not invent its own channels.

## API shape (Kotlin, in MCPlus)

```kotlin
object MessageBus {
    fun <T : Any> publish(channel: String, type: String, payload: T)
    fun <T : Any> subscribe(
        channel: String,
        type: String,
        codec: MessageCodec<T>,
        handler: (Envelope<T>) -> Unit
    ): Subscription
    fun subscribePattern(pattern: String, handler: (Envelope<JsonNode>) -> Unit): Subscription
}

data class Envelope<T>(
    val type: String,
    val version: Int,
    val timestamp: Long,
    val source: String,
    val payload: T,
)

interface MessageCodec<T> {
    fun encode(value: T): JsonNode
    fun decode(node: JsonNode): T
    val supportedVersion: Int
}
```

Implemented on top of the existing `RedisPublisher` + `RedisPubSubManager`. Adds:
- Typed envelopes with Jackson serialization (reuse `JsonFormatFactory.mapper`).
- A codec registry so handlers receive `T`, not `String`.
- A single shared subscriber connection that demuxes by channel/type, instead of one `RedisPubSubManager` per consumer.
- Pattern subscribe (`psubscribe`).

## What we DO NOT build

- Acks / retries / dead-letter — Redis pub/sub is fire-and-forget. If we ever need reliability, use Redis Streams as a separate primitive, don't try to bolt reliability onto pub/sub.
- Request/response. That's RPC, different concern.
- Schema registry. `version` in the envelope is sufficient until we hit a real breaking change.

## Messages we use day one

### `mcplus.collectionlog.holder.reload`

Published by the website after a successful `grant_entries` / `revoke_entries` call. Tells the plugin "drop your cached `LogHolder` for this UUID and pull fresh from MCPlus."

```jsonc
// payload
{ "uuid": "550e8400-e29b-41d4-a716-446655440000" }
```

Subscriber lives in `MCPlusPlayerManager`. On message:
1. If the player is online (`Bukkit.getPlayer(uuid)` non-null), call `StateService.INSTANCE.getManager().load(uuid)` and replace the cached holder atomically.
2. If offline, no-op — next login will pull fresh anyway.

### `mcplus.collectionlog.catalog.reload`

Published by the plugin after it re-syncs the catalog projection (admin command, plugin reload). Lets the website invalidate any in-memory catalog caches it built.

```jsonc
// payload
{ "collectionCount": 12, "entryCount": 847 }
```

Website subscriber (if/when we add server-side caching) drops its cache. Initial implementation does no caching on the website, so this is a no-op for now — but we publish it anyway so future consumers exist.

## Local dev shim

In dev (PGlite, no Redis), `publish()` writes to console and persists the last 100 events to `mock.db` in a `dev_messagebus_log` table. Useful for verifying the publish path during UI work without standing up Redis.
