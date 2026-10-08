# Milestone 28: JWT Access Token

## Login flow

```text
email + password
  -> find User
  -> bcrypt compares password with passwordHash
  -> JWT signs user ID and role
  -> API returns user + short-lived access token
```

## JWT payload

```json
{
  "sub": "user UUID",
  "role": "USER",
  "iat": 0,
  "exp": 0
}
```

`sub` means subject: the ID of the authenticated user. `exp` is fifteen minutes after the token was created.

## Important security notes

- A JWT is signed, not encrypted. Do not put passwords or sensitive personal data inside it.
- The signature uses `JWT_SECRET` from the environment.
- The client sends the token later using `Authorization: Bearer <token>`.
- This milestone creates access tokens only. Refresh tokens and protected-route middleware come next.
