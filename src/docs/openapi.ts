export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Mini ERP API",
    version: "1.0.0",
    description: "Learning API documentation for Mini ERP.",
  },
  servers: [{ url: "http://localhost:3000" }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
  paths: {
    "/health": {
      get: {
        summary: "Check API health",
        responses: { "200": { description: "API is healthy" } },
      },
    },
    "/api/auth/login": {
      post: {
        summary: "Log in and receive an access token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", format: "password" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Logged in" },
          "401": { description: "Invalid credentials" },
        },
      },
    },
    "/api/auth/me": {
      get: {
        summary: "Get the current user",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Current user" },
          "401": { description: "Missing or invalid access token" },
        },
      },
    },
  },
};
