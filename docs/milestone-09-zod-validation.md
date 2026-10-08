# Milestone 9: Zod Body Validation

## Flow

```text
POST /products
  -> logger
  -> express.json() parses JSON bytes
  -> validateBody(createProductSchema)
  -> controller
  -> service
```

## Why this split?

The controller no longer knows the rules for a valid product. The Zod schema holds those rules in one reusable location, and the validation middleware applies any schema before a controller runs.

## Important boundary

TypeScript types disappear at runtime. Zod checks real HTTP data at runtime, then TypeScript can infer `CreateProductInput` from the same schema.

## Spring Boot comparison

This is similar to a DTO plus `@Valid`, with the validation middleware playing the role of Spring's request-validation step.
