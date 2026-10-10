export const authPaths = {
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
};
