# Milestone 8: Products Controller and Service

## Request flow

```text
HTTP request
  -> products router chooses a controller
  -> controller validates HTTP input and builds an HTTP response
  -> service owns product operations and in-memory data
```

## Responsibilities

- Router: URL and HTTP method mapping.
- Controller: request/response concerns, including status codes and input validation.
- Service: product operations and application data.

## Spring Boot comparison

This is the familiar Spring structure: `@RestController` maps to the controller and `@Service` maps to the service. The router plays the role usually performed by Spring's annotation-based request mapping.

## Why do this now?

The API has enough behavior that one router file was starting to own unrelated jobs. This split preserves current behavior while preparing us to replace in-memory data with a database later.
