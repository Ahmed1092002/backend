export const authPaths = {
  "/api/auth/register": {
    post: {
      summary: "Register a new user",
      requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["email", "name", "password"], properties: { email: { type: "string", format: "email" }, name: { type: "string" }, password: { type: "string", format: "password", minLength: 8 } } } } } },
      responses: { "201": { description: "User registered" }, "409": { description: "Email already exists" } },
    },
  },
  "/api/auth/login": {
    post: {
      summary: "Log in and receive an access token",
      requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["email", "password"], properties: { email: { type: "string", format: "email" }, password: { type: "string", format: "password" } } } } } },
      responses: { "200": { description: "Logged in" }, "401": { description: "Invalid credentials" } },
    },
  },
  "/api/auth/me": {
    get: {
      summary: "Get the current user",
      security: [{ bearerAuth: [] }],
      responses: { "200": { description: "Current user" }, "401": { description: "Missing or invalid access token" } },
    },
  },
  "/api/auth/refresh": {
    post: {
      summary: "Refresh an expired access token",
      description: "Uses the HttpOnly refresh-token cookie and rotates it.",
      responses: { "200": { description: "New access token" }, "401": { description: "Invalid or expired refresh token" } },
    },
  },
  "/api/auth/logout": {
    post: {
      summary: "Log out and revoke the refresh-token session",
      responses: { "204": { description: "Logged out" } },
    },
  },
};
