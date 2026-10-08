# Milestone 14: Product DTO and Mapper

## Three different shapes

```text
HTTP request body
  -> request DTO / Zod schema
  -> service input
  -> Prisma database model
  -> mapper
  -> response DTO
  -> HTTP JSON response
```

## DTO

A DTO describes data crossing a boundary. `ProductResponseDto` is the API response shape: `id`, `name`, and numeric `price`.

## Mapper

A mapper is a function that converts one shape into another. `toProductResponseDto` converts Prisma's `Decimal` price into the API's number price.

## Spring comparison

The Prisma result is closest to a JPA entity. `ProductResponseDto` is like a Java response DTO. The mapper is like a MapStruct mapper or a manually written `toDto(entity)` method.

In TypeScript, DTOs are usually `type` or `interface` declarations. They do not extend the database model; they state exactly which fields cross the API boundary.
