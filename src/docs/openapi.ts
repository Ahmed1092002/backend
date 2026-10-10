import { authPaths } from "./auth.docs.js";
import { productPaths } from "./products.docs.js";
import { userPaths } from "./users.docs.js";

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
    ...authPaths,
    ...productPaths,
    ...userPaths,
  },
};
