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

## Advanced backend path (priority after the current inventory flow)

The Mini ERP is our practice application. The goal is not merely to finish ERP
features; it is to use it to learn production backend and distributed-systems
skills in this order:

1. **Architecture**
   - Clean module boundaries and dependency direction
   - Dependency injection concepts in Node.js
   - Domain events and event-driven design inside a modular monolith
   - When a modular monolith is enough, and when microservices are justified
2. **Database performance and correctness**
   - Indexes and reading query plans
   - Transactions, isolation, row locking, and race conditions
   - Pagination and avoiding N+1 queries
   - Redis caching and cache invalidation trade-offs
3. **Reliable distributed systems**
   - Idempotency keys for requests such as order creation
   - Retries, backoff, dead-letter queues, and failure recovery
   - Background workers and exactly-once versus at-least-once delivery
4. **Production engineering**
   - Structured logs, correlation/request IDs, error tracking, and metrics
   - Health/readiness checks and graceful shutdown
   - CI/CD deeper concepts and deployment when cloud access is available
5. **Service communication and real-time systems**
   - REST compared with GraphQL and gRPC
   - RabbitMQ compared with Kafka: queues, events, consumer groups, and use cases
   - Socket.IO/WebSockets compared with WebRTC
   - Reverse proxies, load balancers, HTTPS, and scaling multiple API instances

We will learn RabbitMQ and Kafka through small isolated exercises first; we
will not add both technologies to the Mini ERP without a real reason.

## Immediate next step

Start Docker Desktop, then apply the `RefreshToken` migration. Next, we will
build `POST /api/auth/refresh`, which exchanges a valid refresh token for a
new short-lived access token.
