# Milestone 4: Request Logger Middleware

## What changed

Every request now passes through `requestLogger` before Express tries to match a route.

```text
GET /health
  -> requestLogger starts timing
  -> health route sends JSON
  -> response finishes
  -> logger writes method, path, status, and duration
```

## Why it matters

One shared concern can run once for every route. We will use the same pattern for JSON parsing, authentication, validation, correlation IDs, and error handling.

## Spring Boot comparison

This is closest to a servlet filter or Spring `HandlerInterceptor`.

## Key rule

Middleware must call `next()` when it wants the request to continue. Without it, the request stays stuck in that middleware.
