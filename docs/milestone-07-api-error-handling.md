# Milestone 7: API Error Handling

## What changed

The API now returns JSON errors for missing routes and malformed JSON.

```text
Request
  -> logger
  -> JSON parser
  -> router
  -> no matching route: JSON 404
  -> parser error: error handler returns JSON 400
```

## Why ordering matters

The 404 handler must be after routes, otherwise it would answer every request before any route gets a chance. The error handler must have four parameters and be registered last so Express recognizes it as error middleware.

## Spring Boot comparison

The error handler plays a similar role to `@ControllerAdvice` with `@ExceptionHandler` methods.

## Current behavior

- Unknown route: `404 { "error": "Route not found" }`
- Invalid JSON: `400 { "error": "Request body must be valid JSON" }`
- Unexpected error: `500 { "error": "Internal server error" }`
