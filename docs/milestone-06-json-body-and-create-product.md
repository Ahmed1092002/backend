# Milestone 6: JSON Request Bodies and Create Product

## Request flow

```text
POST /products with JSON bytes
  -> request logger
  -> express.json() parses those bytes
  -> req.body becomes a JavaScript object
  -> product route validates name and price
  -> product is stored in memory
  -> HTTP 201 JSON response
```

## Why `express.json()` exists

HTTP sends a request body as bytes. Express does not know that those bytes are JSON until `express.json()` runs. Without it, `req.body` is not the parsed product object.

## Status codes

- `201 Created`: a valid product was created.
- `400 Bad Request`: the client sent invalid product data.

## Spring Boot comparison

`express.json()` is comparable to Spring MVC's JSON message conversion for an `@RequestBody`. The manual checks are a temporary version of DTO validation; we will later use a validation library.

## Important limitation

Products disappear when the Node process restarts. This is intentional: a database has not yet earned its complexity in the learning path.
