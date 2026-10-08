# Milestone 15: Product Repository

## Responsibilities

```text
Controller  -> HTTP request and response
Service     -> product behavior and mapping
Repository  -> Prisma queries
Mapper      -> Prisma model to response DTO
```

## Why add a repository?

The service no longer contains `prisma.product.findMany()` or other database calls. If database access changes later, the Product service remains focused on behavior.

## When not to add one

For a tiny feature with one simple query, calling Prisma directly in a service is fine. We use a repository here because the Product module now has several database operations and the project is teaching explicit data-access ownership.

## Spring Boot comparison

`products.repository.ts` is similar to a Spring Data JPA repository. The difference is that these functions are written manually around Prisma rather than generated from a Java interface.
