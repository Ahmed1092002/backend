# Docker Learning Path — Mini ERP

This is a practical Docker track for this project. We will learn each concept by using it, not by memorizing commands.

## The problem Docker solves here

PostgreSQL must run somewhere. Installing it manually on every developer machine creates differences in versions, ports, users, and passwords.

```text
Without Docker
Your machine -> manually installed PostgreSQL

With Docker
Your machine -> Docker -> identical PostgreSQL container
```

## Lesson 1 — Image vs container

```text
Image     = reusable blueprint, like a class/template
Container = one running copy of that image, like an object/process
```

Our project uses the `postgres:16-alpine` image. Docker will create a running PostgreSQL container from it.

Commands to run after Docker Desktop is running:

```powershell
docker image ls
docker ps
```

## Lesson 2 — Docker Compose in this project

`docker-compose.yml` describes services that belong together.

Current project:

```text
docker-compose.yml
  -> postgres service
      -> postgres:16-alpine image
      -> database user, password, and name
      -> port 5433 on your computer
      -> persistent volume
```

Start it:

```powershell
docker compose up -d postgres
docker compose ps
docker compose logs postgres
```

Stop it without deleting data:

```powershell
docker compose stop postgres
```

Start it again:

```powershell
docker compose start postgres
```

## Lesson 3 — Ports

```text
Node.js / Prisma on your machine
  -> localhost:5433
  -> Docker maps it to container port 5432
  -> PostgreSQL
```

The mapping in `docker-compose.yml` is:

```yaml
ports:
  - "5433:5432"
```

Left side: your computer. Right side: inside the container.

## Lesson 4 — Volumes

Containers can be deleted and recreated. A Docker volume keeps database files outside that temporary container lifecycle.

```text
PostgreSQL container
  -> postgres_data volume
  -> data survives container restart/recreation
```

Our named volume is `postgres_data`.

## Lesson 5 — Environment variables

The PostgreSQL container receives its initial database settings from Compose:

```text
POSTGRES_USER
POSTGRES_PASSWORD
POSTGRES_DB
```

The Node application uses `DATABASE_URL` from `.env` to connect to PostgreSQL.

These are two separate environments:

```text
Docker container configuration != Node application's connection configuration
```

## Lesson 6 — Dockerfile, later

A `Dockerfile` explains how to build an image for **our Node API**.

We are deliberately not adding one yet. Right now Docker runs only PostgreSQL, while Node stays on your machine so you can edit and watch it easily.

Later:

```text
Dockerfile -> Mini ERP Node API image
Docker Compose -> Node API container + PostgreSQL container
```

## Practical checkpoint

Once Docker Desktop is running, we will execute:

```powershell
docker compose up -d postgres
docker compose ps
npm run db:migrate -- --name init
```

Then Prisma will create the `Product` table in PostgreSQL. That is our first real Docker application in this project.

## Cheat sheet

```powershell
docker ps                    # running containers
docker image ls              # downloaded images
docker compose up -d         # start services in background
docker compose ps            # service status
docker compose logs postgres # database logs
docker compose stop          # stop, preserve data
docker compose down          # remove containers, preserve named volumes
```

Do not run `docker compose down -v` unless you intentionally want to delete the database volume and all its data.
