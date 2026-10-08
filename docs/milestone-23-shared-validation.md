# Milestone 23: Shared Validation Middleware

## What changed

The validation implementation now lives in one `validate` function. The readable wrappers remain:

```text
validateBody(schema)
validateQuery(schema)
validateParams(schema)
```

## Why keep wrappers?

Routes still show where their input comes from, while the parsing, error response, and `next()` behavior are not duplicated.

```text
Router uses wrapper
  -> wrapper calls validate(schema, source, fallbackError)
  -> generic middleware reads the correct req source
  -> Zod validates
  -> validated values continue to controller
```
