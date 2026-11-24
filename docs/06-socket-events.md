# Socket.IO Events

## Connection

The backend Socket.IO server is attached to the same Node HTTP server as Express and uses the default `/socket.io` path. In local development, the Vite proxy forwards that path to port 4000 with WebSocket support. The client uses the page's origin unless `VITE_SOCKET_URL` is explicitly set. Socket.IO's default transports and reconnection behavior are retained.

Allowed origins are configured through the backend `FRONTEND_ORIGINS` setting. Development defaults include `http://localhost:5173` and `http://127.0.0.1:5173`.

The browser sends the same HttpOnly `salon_queue_access` cookie as HTTP. A socket without a valid token may subscribe only to the customer-safe `queue:display` room. Reception, customer booking, and barber room subscriptions require an authorized role/identity. Logout, staff password reset, and staff deactivation disconnect that account's active sockets.

## Client subscription events

| Client emits | Server action |
| --- | --- |
| `reception:subscribe` | Owner or Receptionist joins the `reception` room. |
| `queue:subscribe` | Any visitor joins the customer-safe `queue:display` room. |
| `queue:booking:subscribe` with a booking UUID | Owner/Receptionist, assigned Barber, or owning Customer may join that booking's `queue:booking:<id>` room. |
| `barber:subscribe` with a barber UUID | Owner/Receptionist may join barber rooms; a Barber may join only their own barber room. |

Invalid or unknown IDs are ignored for booking and barber subscriptions.

## Server broadcasts

Queue mutations publish `queue:updated` to the reception and waiting-display rooms; booking-specific events are also sent to the display room and relevant booking/barber rooms. Server event names include:

- `queue:updated`
- `queue:joined`
- `queue:called`
- `queue:cancelled`
- `queue:no-show`
- `service:started`
- `service:completed`
- `barber:updated`
- `salon:queue-status`

The display's primary refresh trigger is `queue:updated`; it also listens for `queue:called` to highlight the called token and trigger the allowed notification behavior. Clients should treat these events as signals to refresh the appropriate API response rather than as complete dashboard snapshots.

## Payload

Broadcast payloads have this shape:

```json
{
  "eventId": "UUID",
  "occurredAt": "ISO-8601 timestamp",
  "queueEntryId": "UUID or null",
  "token": "S-1 or null",
  "status": "waiting | called | in_service | completed | cancelled | no_show | null",
  "position": 1,
  "customersAhead": 0,
  "estimatedWaitMinutes": 0,
  "barberId": "UUID or null",
  "barberStatus": "available | busy | on_break | null",
  "queueOpen": true
}
```

Fields that do not apply to a particular event are `null`. Payloads intentionally exclude customer names and phone numbers.

## Frontend lifecycle

The shared client is configured with `autoConnect: false`. Live pages connect while mounted, register named handlers, emit the needed subscription, and remove their handlers and disconnect on cleanup. On `connect`, pages resubscribe and refresh their API-backed state. `connect_error` and `disconnect` update the visible connection state; Socket.IO reconnects automatically.
