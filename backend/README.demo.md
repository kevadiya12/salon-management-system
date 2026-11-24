# Development demo data

Run the demo seed from the backend directory:

```powershell
npm.cmd run seed:demo
```

The seed is idempotent and does not remove or replace existing records.

## Demo credentials

- Barber account pattern: `demo.barber01@example.test` through `demo.barber10@example.test`
- Customer account pattern: `demo.customer001@example.test` through `demo.customer100@example.test`
- Username pattern for barbers: `barber01` through `barber10`
- Development password for all demo barber and customer accounts: `Demo@123456`

The demo password is only for local/development use. These accounts use `.example.test`/`.test` email addresses and should not be used as real credentials.
