# Milestone 27: Async Handler

## Job

`asyncHandler` wraps an async Express controller and forwards a rejected promise to `next(error)`.

```text
async controller
  -> rejected promise
  -> asyncHandler catches it
  -> next(error)
  -> global errorHandler
```

## Why use it?

It makes error propagation explicit and is common in Express 4 projects, where rejected async controller promises are not forwarded automatically.

## Express 5 note

This project uses Express 5. Express 5 already forwards rejected async route promises automatically, so this wrapper is not required here. We keep it as a visible learning pattern and for familiarity with common Express codebases.
