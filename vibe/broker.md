# MQTT Broker — Deep Dive

The `broker/` directory contains a Node.js MQTT broker built on
[Aedes](https://github.com/moscajs/aedes) with password-based room
authorization. It synchronizes multiple geekslides browser instances
in real time.

## Stack

| Component | Library | Version |
|---|---|---|
| MQTT broker core | aedes | ^0.46.1 |
| TCP server | Node `net` module | — |
| WebSocket server | websocket-stream | ^5.5.2 |
| TLS (optional) | Node `https` module | — |
| Logging | winston | ^3.3.3 |
| Default password | generate-password | ^1.6.1 |

## Network listeners

The broker creates up to three listeners:

| Protocol | Port (default) | Env var | Purpose |
|---|---|---|---|
| TCP | 1883 | `TCP_PORT` | Server-to-server / CLI MQTT clients |
| WebSocket | 8883 | `WS_PORT` | Browser connections via Caddy reverse proxy (no TLS) |
| WebSocket Secure | 8443 | `WSS_PORT` | Direct browser connections with TLS |

The WSS listener is only started if `CERT_PATH` environment variable is set
(pointing to a directory with `privkey.pem` and `cert.pem`).

In the Docker deployment, browsers connect to Caddy on `:443` which proxies
`/mqtt` to the WS listener on `:8883`. The WSS listener is not needed in
that scenario.

## Authentication model

```
aedes.authenticate = (client, username, password, callback)
```

**Rules:**
- `username` is **required** — connections without a username are rejected
- `password` is optional (empty string is accepted)
- Password is decoded from Base64 (Paho MQTT transmits it encoded)
- All connections providing a username are accepted ("everyone is authenticated")
- A `User` object is stored in `usersById[client.id]` for later authorization

**Administrator:**
- Username: `administrator`
- Password: auto-generated at startup (logged to console) or `ADMIN_PASS` env var
- Admins can subscribe to wildcard topics and root topics

## Room model

### Class: `Room`

```js
class Room {
  name;      // string — extracted from topic path
  password;  // string — set by the first publisher

  isAuthorizedToPublish(user) {
    return user.password === this.password;
  }
}
```

### Room lifecycle

1. **Creation**: A room is auto-created when the first client publishes to
   `rooms/<name>/state/<anything>`. The room's password is set to the
   publishing client's password.

2. **Publishing**: Only clients whose password matches the room password can
   publish. Others receive an authorization error.

3. **Password change**: Publishing to `rooms/<name>/config/password` with the
   room's current auth updates the room's password to the message payload.

4. **Subscription**: Anyone can subscribe to room topics (except `config` topics
   and wildcards for non-admins).

### Topic patterns

```
rooms/<roomName>/state/slides              ← slide navigation (location, control)
rooms/<roomName>/state/slides/whiteboard   ← whiteboard strokes
rooms/<roomName>/state/slideShowLoaded     ← retained: current presentation URL
rooms/<roomName>/config/password           ← room password management
$SYS/greekslides                           ← broker stats (published periodically)
```

## Authorization rules

### Subscribe authorization

```
aedes.authorizeSubscribe = (client, subscription, callback)
```

| Client type | Wildcard topics (`#`, `+`) | `rooms/…` topics | Root topics |
|---|---|---|---|
| Administrator | ✅ Allowed | ✅ Allowed | ✅ Allowed |
| Regular user | ❌ Denied | ✅ Allowed | ❌ Denied |

### Publish authorization

```
aedes.authorizePublish = (client, message, callback)
```

| Condition | Result |
|---|---|
| Topic doesn't match `rooms/<name>/...` pattern | ❌ Denied |
| Room doesn't exist | ✅ Room created, publish allowed |
| Room exists and `user.password === room.password` | ✅ Allowed |
| Room exists and password doesn't match | ❌ Denied |

## Stats publishing

Every 30 seconds (10 in dev mode):

```json
{
  "numberOfRooms": 3,
  "numberOfUsers": 12
}
```

Published to `$SYS/greekslides` with QoS 0, not retained.

## Event logging

The broker logs all significant events with Winston:

| Event | Log level | Tag |
|---|---|---|
| Client authenticated | info | `[CLIENT_AUTHENTICATED]` |
| Client connected | debug | `[CLIENT_CONNECTED]` |
| Client disconnected | debug | `[CLIENT_DISCONNECTED]` |
| Topic subscribed | debug | `[TOPIC_SUBSCRIBED]` |
| Topic unsubscribed | debug | `[TOPIC_UNSUBSCRIBED]` |
| Room created | info | `[ROOM_CHANGE]` |
| Room password changed | info | `[ROOM_CHANGE]` |
| Subscribe auth error | warn | `[SUBS_AUTH_ERROR]` |
| Publish auth error | warn | `[PUB_AUTH_ERROR]` |

In production, logs go to `error.log` (error level). In non-production, also
to console.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `TCP_PORT` | 1883 | MQTT TCP port |
| `WS_PORT` | 8883 | WebSocket port |
| `WSS_PORT` | 8443 | Secure WebSocket port |
| `CERT_PATH` | — | Directory with TLS certificates (enables WSS) |
| `ADMIN_PASS` | auto-generated | Administrator password |
| `NODE_ENV` | — | Set to `dev` for verbose logging; `production` for file-only |

## Running

```bash
# Install dependencies
npm --prefix broker install

# Start (production)
npm --prefix broker run start

# Start (development with nodemon + inspector)
npm --prefix broker run dev
```

## Message flow: browser → broker → browsers

```
Browser A (presenter)                    Broker                    Browser B (viewer)
    │                                      │                           │
    │ CONNECT(username=producer,           │                           │
    │         password=secret)             │                           │
    │─────────────────────────────────────▶│                           │
    │                                      │ User stored in usersById  │
    │                                      │                           │
    │ SUBSCRIBE rooms/demo/state/slides    │   CONNECT(username=viewer)│
    │─────────────────────────────────────▶│◀──────────────────────────│
    │                                      │                           │
    │                                      │ SUBSCRIBE rooms/demo/     │
    │                                      │   state/slides            │
    │                                      │◀──────────────────────────│
    │                                      │                           │
    │ PUBLISH rooms/demo/state/slides      │                           │
    │   {action:"location",                │                           │
    │    currentSlideIndex: 5}             │                           │
    │─────────────────────────────────────▶│                           │
    │                                      │ Room "demo" created       │
    │                                      │ password = "secret"       │
    │                                      │                           │
    │                                      │ FORWARD to Browser B      │
    │                                      │──────────────────────────▶│
    │                                      │                           │ gotoSlideIndex(5)
    │                                      │                           │
```
