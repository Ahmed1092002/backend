# Milestone 22: Update User and Email Lookup

## Update endpoint

```text
PATCH /api/users/:id
```

The body can contain a new `name`, a new `email`, or both. It must contain at least one field.

## Email lookup endpoint

```text
GET /api/users/email/:email
```

This route is before `GET /api/users/:id`. Otherwise Express would incorrectly treat the word `email` as an ID.

## Parameter validation

`validateParams` validates `req.params`, while `validateBody` validates JSON request bodies. A GET URL parameter is not a request body.
