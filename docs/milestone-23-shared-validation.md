# Milestone 23: Shared Validation Middleware

## What changed

The validation implementation now lives in one `validate` function:

```text
validate(schema)           -> body (default)
validate(schema, "query") -> query string
validate(schema, "params") -> URL parameters
```

## Why keep wrappers?

The body is the default because request bodies are the common create/update input. Routes explicitly name query or params when needed.

```text
Router calls validate(schema, source)
  -> generic middleware reads the correct req source
  -> Zod validates
  -> validated values continue to controller
```
