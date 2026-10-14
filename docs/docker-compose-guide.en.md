# Docker Compose in Mini ERP

This guide explains how `docker-compose.yml` runs the complete local project stack, why each service exists, and how to inspect it.

## The idea

Without Compose, PostgreSQL, Redis, the API, the worker, and monitoring would be started separately with manually configured ports, environment variables, and networking. Compose defines the stack in one repeatable file.

```text
docker-compose.yml
  ├─ postgres       primary data
  ├─ redis          cache and BullMQ queues
  ├─ migrate        applies Prisma migrations once
  ├─ seed           inserts learning data once
  ├─ api            Express and Socket.IO
  ├─ worker         email jobs
  ├─ mailpit        local email inbox
  ├─ prometheus     metrics collection
  ├─ alertmanager   alert delivery to Mailpit
  └─ grafana        dashboards
```

Compose automatically creates a default network. The API can therefore use `postgres` and `redis` as hostnames. Containers must not use `localhost` to reach each other.

## 1. Shared image: Dockerfile

The root `dockerfile` describes one shared image used by `api`, `worker`, `migrate`, and `seed`:

```dockerfile
from node:22-alpine

workdir /app
copy package.json package-lock.json ./
run npm ci
copy . .
RUN npx prisma generate
expose 3000
CMD ["npm", "run", "dev:server"]
```

| Line | Why it exists |
| --- | --- |
| `from node:22-alpine` | Small image containing Node 22. |
| `workdir /app` | Sets the work folder inside the container. |
| Package files then `npm ci` | Installs exact lockfile dependencies and makes the layer cacheable. |
| `copy . .` | Copies source after dependencies. |
| `prisma generate` | Prisma Client is generated code and must exist in the image. |
| `expose 3000` | Documents the API port; it does not publish it to Windows by itself. |
| `CMD` | Default command; a service can replace it with `command`. |

`.dockerignore` excludes `node_modules`, `.git`, `.env`, and `dist`. This keeps the image smaller and avoids baking `.env` secrets into it.

## 2. PostgreSQL and a data volume

```yaml
postgres:
  image: postgres:16-alpine
  ports:
    - "5433:5432"
  volumes:
    - postgres_data:/var/lib/postgresql/data
```

- PostgreSQL listens on `5432` inside the container.
- Windows connects through `localhost:5433`.
- The `postgres_data` named volume keeps data after container recreation.
- Other services connect through `postgres:5432`, because `postgres` is the service name.

The healthcheck is:

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
  interval: 5s
  timeout: 5s
  retries: 10
```

A started container is not necessarily a ready database. `pg_isready` proves it accepts connections. `$$` makes Compose pass `$POSTGRES_USER` to the container shell instead of reading it from Windows.

## 3. Redis and persistence

```yaml
redis:
  image: redis:7-alpine
  command: ["redis-server", "--appendonly", "yes"]
  volumes:
    - redis_data:/data
```

Redis is used for caching and BullMQ. `--appendonly yes` writes operations to `/data`, while `redis_data` keeps them through restarts. That is useful for queues, but Redis does not replace PostgreSQL as the source of business data.

## 4. Why `migrate` and `seed` are separate services

```yaml
migrate:
  build: .
  command: npx prisma migrate deploy
  depends_on:
    postgres:
      condition: service_healthy
  restart: "no"

seed:
  build: .
  command: npm run db:seed
  depends_on:
    migrate:
      condition: service_completed_successfully
  restart: "no"
```

- `build: .` uses the root Dockerfile.
- `command` replaces the image's default `CMD` only for that service.
- Migration waits for a healthy database.
- Seed waits for migration success, avoiding data insertion into an old schema.
- `restart: "no"` is correct because these are one-time jobs, not servers.

## 5. API and worker

The API keeps the default command and exposes port 3000. Important variables include:

```yaml
DATABASE_URL: postgresql://erp_user:erp_password@postgres:5432/mini_erp?schema=public
REDIS_URL: redis://redis:6379
MAIL_HOST: mailpit
MAIL_PORT: 1025
```

These are service names inside Docker, not `localhost`.

The worker reuses the same image but changes its command:

```yaml
worker:
  build: .
  command: npx tsx src/workers/email.worker.ts
```

The API receives HTTP while the worker consumes email jobs from Redis in another process. `upload_images:/app/uploads` keeps uploaded product images when the API container is recreated.

## 6. Monitoring services

Prometheus scrapes `api:3000/metrics`, Grafana reads Prometheus, and Alertmanager sends alerts to Mailpit. Configuration comes from project files, while runtime data goes into named volumes:

```text
Git configuration                 Docker runtime data
prometheus.yml                    prometheus_data
Grafana dashboard JSON            grafana_data
alertmanager.yml                  alertmanager_data
```

See the [metrics guide](observability-monitoring.en.md) for details.

## 7. Practical commands

Start and rebuild everything:

```powershell
docker compose up -d --build
```

`up` creates and starts services, `-d` runs them in the background, and `--build` rebuilds images from current source.

Inspect status and logs:

```powershell
docker compose ps
docker compose logs -f api
docker compose logs -f worker
docker compose logs -f prometheus
```

Validate YAML without starting containers:

```powershell
docker compose config --quiet
```

Control one service:

```powershell
docker compose stop api
docker compose start api
docker compose restart prometheus
```

Stop the stack:

```powershell
docker compose down
```

Do not use `docker compose down -v` unless you intentionally want to delete local PostgreSQL, Redis, and Grafana data.

## 8. Startup order

```text
postgres healthy
     -> migrate finishes
     -> seed finishes
     -> api starts
     -> Prometheus scrapes API
     -> Grafana reads Prometheus
```

`depends_on` coordinates startup only. It cannot repair later failures; that is why health checks, readiness, and logs still matter.

## 9. Common problems

| Problem | Cause | Fix |
| --- | --- | --- |
| `port is already allocated` | Another process/service uses a port such as 3000 | Stop it or change the host port. |
| API cannot reach DB | `localhost` was used in Compose | Use `postgres:5432`. |
| Data disappeared | `down -v` was used | Use it only for an intentional clean start. |
| Code changed but the container is old | No `--build` | Run `docker compose up -d --build`. |
| Seed did not run | Migration failed | Inspect `docker compose logs migrate`. |

## 10. Summary

Docker Compose is not production deployment by itself. It is a repeatable local way to run multiple services with networking, volumes, and configuration. The concepts carry over to Kubernetes and cloud services even when the tools change.
