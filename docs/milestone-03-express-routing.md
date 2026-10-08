# Milestone 3: Express Routing

## Concept

Express registers request handlers against HTTP methods and paths. It runs on top of Node.js's HTTP server.

## Why

Native Node routing with `if (method === ... && url === ...)` quickly becomes hard to maintain as an API gains routes.

## Spring Boot comparison

| Spring Boot | Express |
| --- | --- |
| `@RestController` | application/router module |
| `@GetMapping("/health")` | `app.get("/health", handler)` |
| servlet filter | middleware |
| `ResponseEntity` | `res.status(...).json(...)` |

## Architecture and request flow

```text
Client
  -> Node HTTP server
  -> Express application
  -> matching route handler
  -> JSON HTTP response
```

For `GET /health`, Express finds the matching handler, which serializes a JSON response. A request with no matching handler receives Express's default 404 response.

## Code

- `src/server.ts` starts the process and listens on a port.
- `src/app.ts` owns the HTTP application and its routes.

## Common mistakes

- Putting all routes in the startup file.
- Assuming Express validates input automatically.
- Forgetting that route registration order matters.

## Production notes

We will later replace the default 404 response with a consistent error format, add middleware, validation, and feature routers.

## Exercises

- Easy: add `GET /version`.
- Medium: add an in-memory `GET /products` endpoint.
- Hard: add `GET /products/:id` with a JSON 404 for a missing product.

## Key takeaways

Express improves routing and response helpers; Node.js remains the runtime and ultimately writes the HTTP response.
