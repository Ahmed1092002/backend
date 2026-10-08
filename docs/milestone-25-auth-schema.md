# Milestone 25: Authentication Schema Preparation

## New User fields

```text
passwordHash  optional password hash
role          ADMIN, MANAGER, or USER
```

## Why is `passwordHash` optional now?

The database already has a learning user created before authentication existed. Making the new column required would fail because that old row has no password.

```text
Safe expansion now
  -> passwordHash can be null
  -> all existing rows remain valid

Later authentication work
  -> registration always creates a hash
  -> old users can reset/set a password
  -> optionally make the database column required
```

## Security rule

The database never stores a plain password. It stores a one-way password hash only.
