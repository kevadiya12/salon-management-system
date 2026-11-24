# Database Schema

The schema is created and migrated by `backend/src/database/reception-schema.ts`. PostgreSQL foreign keys and check constraints enforce relationships and valid values. Timestamps are stored as text, generally ISO-8601 strings, to preserve the existing API representation.

## Tables

| Table | Purpose and principal columns |
| --- | --- |
| `customers` | Customer records: `id`, `name`, `phone_number`, `created_at`, `updated_at`. Phone number has a uniqueness-supporting lookup index; it is not unique by itself. |
| `salon_services` | Catalogue: `id`, `name`, optional `description`, `duration_minutes`, `price_rupees`, `is_active`, timestamps. |
| `reception_settings` | Key/value settings. Includes `queue_open`, salon name/address/contact, opening/closing times, weekly working days, and optional queue capacity. |
| `reception_barbers` | Barber identity and availability: `id`, `name`, optional `photo_url`, `status`, `is_active`, timestamps. Status is `available`, `busy`, or `on_break`; `is_active` defaults to 1. |
| `users` | Authentication identities: `id`, `name`, case-insensitive unique `email`, optional case-insensitive unique `username`, `password_hash`, `role`, optional `barber_id` or `customer_id`, `is_active`, `token_version`, and timestamps. |
| `reception_bookings` | Queue and customer snapshot: autoincrement `queue_order`, `id`, token and token day, customer references/name/phone, service IDs, duration and price totals, source, preferred/assigned barber references, status, timestamps, and call/start/completion timestamps. |
| `booking_services` | Service snapshot per booking: `booking_id`, `service_id`, `service_name`, `duration_minutes`, `price_rupees`. |
| `service_records` | Service lifecycle record: `id`, unique `booking_id`, optional `barber_id`, `started_at`, optional `completed_at`, timestamps. |
| `daily_queue_information` | Token sequence by `queue_day`, with `next_token_sequence` and timestamps. |

## Relationships and constraints

- A customer can have many bookings; a booking's `customer_id` is nullable for legacy compatibility.
- A booking can store one or more selected services. Service names, durations, and prices are snapshotted in `booking_services`.
- Preferred and assigned barber IDs reference `reception_barbers`.
- A `BARBER` user is linked to exactly one barber profile; a `CUSTOMER` user is linked to exactly one customer record. Owner and receptionist accounts have neither link.
- Unique partial indexes prevent multiple user accounts for one barber/customer and restrict the database to one `OWNER` account. `token_version` invalidates previously issued access tokens after logout or staff account security changes.
- Active booking status is limited to `waiting`, `called`, or `in_service`; terminal values are `completed`, `cancelled`, and `no_show`.
- Partial unique indexes permit at most one active called/in-service booking per barber and at most one active booking per phone number.
- Tokens are unique per token day. Queue ordering uses `queue_order`.
- Database checks constrain names, phone number format, positive service durations, nonnegative prices, and allowed enum values.

## Initialization and migration

Startup creates missing tables and indexes, adds supported columns to older PostgreSQL schemas, and migrates legacy booking customer/service data in a transaction. The built-in `Haircut`, `Beard Trim`, and `Hair Spa` rows are inserted if absent. Existing records are not replaced with sample queue data. The initial owner account is created separately by `npm run seed:owner`.

## Not persisted

Logo and theme values are not persisted; they remain frontend Vite environment settings. Passwords are stored only as bcrypt hashes. Stored business hours do not automatically alter queue-open state.
