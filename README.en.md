# Mini ERP Backend

A practical learning backend built with **Node.js + TypeScript**. It is a small ERP-style API containing products, inventory, users, orders, authentication, background jobs, realtime updates, and production-oriented operational tooling.

The goal is not to be a complete ERP. The goal is to see backend concepts working together inside one project.

## What the project includes

- Express 5 and TypeScript, organised into `auth`, `products`, `orders`, and `users` modules.
- PostgreSQL and Prisma for persistent data and migrations.
- JWT access tokens plus HTTP-only-cookie refresh tokens, with `ADMIN`, `MANAGER`, and `USER` roles.
- Products, inventory, and `InventoryMovement` history.
- Orders: creation, confirmation, and safe stock reduction in one database transaction.
- Idempotency keys to prevent one frontend/network request from creating the same order twice.
- Redis for caching and BullMQ for background jobs.
- Socket.IO for realtime product and order notifications.
- Product-image uploads and confirmed-order invoice PDFs.
- Swagger, Zod validation, rate limiting, CORS, and central error handling.
- Structured JSON logs, health checks, Prometheus metrics, Grafana, and Alertmanager.
- Docker Compose for running the full local stack.

## Run the full project with Docker

Requirement: Docker Desktop must be running.

```powershell
docker compose up -d --build
```

This builds the API and worker, then starts PostgreSQL, Redis, Mailpit, Prometheus, Grafana, and Alertmanager. The `migrate` service applies database migrations, the `seed` service inserts learning data, and the API starts after them.

Check status and follow logs:

```powershell
docker compose ps
docker compose logs -f api
docker compose logs -f worker
```

Stop services while keeping local data:

```powershell
docker compose down
```

`docker compose down -v` deletes named volumes, including local PostgreSQL, Redis, and Grafana data. Use it only when you intentionally want a clean start.

## URLs after startup

| Service | URL |
| --- | --- |
| API | http://localhost:3000 |
| Swagger | http://localhost:3000/api-docs |
| Health | http://localhost:3000/health |
| Readiness (checks DB and Redis) | http://localhost:3000/health/ready |
| Prometheus metrics | http://localhost:3000/metrics |
| Mailpit local inbox | http://localhost:8025 |
| Prometheus | http://localhost:9090 |
| Alertmanager | http://localhost:9093 |
| Grafana | http://localhost:3001 |

For local development, Grafana normally starts with `admin` / `admin` and prompts you to change the password.

PostgreSQL is exposed to your computer at `localhost:5433`. Inside Docker Compose, containers use `postgres:5432`. This difference matters: containers use the Compose service name; applications running on your computer use the published host port.

## Run the API outside Docker (optional)

If you want to run TypeScript directly, first start the supporting services or use Compose for them. Then:

```powershell
npm ci
Copy-Item .env.example .env
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run dev:server
```

Edit `.env` before starting. Never commit production secrets. When the API runs outside Docker, `DATABASE_URL` should use `localhost:5433`; in Compose it uses `postgres:5432`.

## Useful commands

```powershell
npm run typecheck
npm test
npx prisma studio
npx prisma migrate dev --name describe_your_change
docker compose up -d --build
docker compose logs -f api
```

Use `prisma migrate dev` during local development when you change `prisma/schema.prisma`. Docker and CI use `prisma migrate deploy`, which applies existing migrations only.

## Code map

```text
src/
  modules/          # business modules: auth, products, orders, users
  middleware/       # auth, validation, errors, request logging, rate limiting
  jobs/             # BullMQ queues/workers and outbox processor
  observability/    # structured logger and Prometheus metrics
  realtime/         # Socket.IO setup and event emitters
prisma/             # schema and SQL migrations
prometheus/         # scrape configuration and alert rules
grafana/            # datasource/dashboard provisioning
alertmanager/       # routes local alerts to Mailpit
docs/               # learning notes
```

## Important concepts used here

- Confirming an order does not only reduce stock. It writes inventory movements, confirms the order, and writes an outbox event in the same transaction.
- The outbox processor publishes that event later to listeners that clear cache, emit Socket.IO updates, and queue low-stock email jobs.
- This makes the event durable: if the API crashes after order data is committed, the event is not lost.
- Delivery is **at least once**, so consumers must be idempotent.

Read the detailed documentation:

- [Observability and monitoring](docs/observability-monitoring.en.md)
- [Outbox pattern](docs/outbox-pattern.en.md)
- [Arabic README](README.md)
- [Arabic observability guide](docs/observability-monitoring.md)
- [Arabic Outbox guide](docs/outbox-pattern.md)

## Production note

This is a learning project, not a production-ready deployment. Before a real deployment, use a secrets manager, HTTPS, strong credentials, real SMTP, suitable file storage, database backups, and an operational process for logs and alerts.
