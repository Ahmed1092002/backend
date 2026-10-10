const userId = { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } };

export const userPaths = {
  "/api/users": {
    get: { summary: "List users", security: [{ bearerAuth: [] }], responses: { "200": { description: "Users" }, "401": { description: "Missing token" } } },
    post: { summary: "Create a user", responses: { "201": { description: "User created" } } },
  },
  "/api/users/{id}": {
    get: { summary: "Get one user", parameters: [userId], responses: { "200": { description: "User" }, "404": { description: "Not found" } } },
    patch: { summary: "Update a user", parameters: [userId], responses: { "200": { description: "User updated" } } },
    delete: { summary: "Delete a user (ADMIN)", security: [{ bearerAuth: [] }], parameters: [userId], responses: { "204": { description: "User deleted" }, "403": { description: "Admin required" } } },
  },
  "/api/users/{id}/role": {
    patch: { summary: "Change a user role (ADMIN)", security: [{ bearerAuth: [] }], parameters: [userId], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["role"], properties: { role: { type: "string", enum: ["USER", "MANAGER", "ADMIN"] } } } } } }, responses: { "200": { description: "Role updated" }, "403": { description: "Admin required" } } },
  },
};
