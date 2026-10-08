# Milestone 11: Delete Product

## Endpoint

`DELETE /products/:id` removes one product from the current in-memory list.

## Status codes

- `204 No Content`: the product was deleted. A 204 response must not contain a response body.
- `404 Not Found`: no product had that ID.

## Flow

```text
DELETE /products/2
  -> router
  -> controller
  -> service finds the array index
  -> service removes one element
  -> 204 response
```

## Temporary behavior

The deletion exists only in the running Node process. Restarting the server restores the initial hard-coded products; persistent deletion needs a database.
