# Mini ERP learning roadmap

We learn by adding one small, useful feature to this API, then running and testing it.

## Current progress

- [x] Node, TypeScript, npm scripts, and Express routing
- [x] Middleware, JSON parsing, 404 handling, and error handling
- [x] Products API: CRUD, validation, pagination, search, filters, and sorting
- [x] PostgreSQL, Prisma, migrations, DTOs, mappers, repositories, and services
- [x] Users, registration, password hashing, login, JWT access tokens
- [x] Authentication middleware and role authorization
- [ ] Refresh-token sessions
- [ ] Docker Compose: API + PostgreSQL together

## Node and Express foundations

We will revisit these with short experiments when they help explain a feature:

- Node runtime, modules, event loop, async I/O, and the worker pool
- HTTP request / response lifecycle, headers, status codes, and REST design
- Express middleware order, routers, and debugging
- Environment variables and configuration

## Backend application skills

We build these into the Mini ERP in this order:

1. Refresh tokens, logout, and `GET /auth/me`
2. Admin user-role management
3. Automated API tests for authentication and authorization
4. File uploads with a Docker volume (for example, product images)
5. E-mail notifications (for example, an invite or password reset)
6. PDF generation (for example, a sales invoice)
7. Payments as an optional, separate learning feature

## Database skills

Our primary database path is PostgreSQL + Prisma. It covers relational design,
relations, migrations, transactions, indexes, and query performance.

After that, we will compare PostgreSQL with MongoDB through a small focused
exercise. We will not replace this project database merely to learn MongoDB.

## API styles

- REST is the main API for this project.
- GraphQL is an optional later module. We will build one small GraphQL feature
  after REST, authentication, and testing are comfortable.
- Server-rendered MVC pages and template engines are optional because this
  project is an API. The router / controller / service / repository structure
  teaches the important backend separation already.

## Production and distributed-systems path

1. Dockerfile, Docker Compose, networks, volumes, and environment variables
2. Logging, health checks, rate limiting, and safe configuration
3. Redis caching
4. Background jobs and queues
5. Retries, idempotency, and failure handling
6. WebSockets for real-time updates
7. CI/CD and deployment
8. Deno overview as an optional comparison with Node.js

## Immediate next step

Start Docker Desktop, then apply the `RefreshToken` migration. Next, we will
build `POST /api/auth/refresh`, which exchanges a valid refresh token for a
new short-lived access token.
