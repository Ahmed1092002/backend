export const orderPaths = {
  "/api/orders": {
    post: {
      summary: "Create a draft order",
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["items"],
              properties: {
                items: {
                  type: "array",
                  minItems: 1,
                  items: {
                    type: "object",
                    required: ["productId", "quantity"],
                    properties: {
                      productId: { type: "string", format: "uuid" },
                      quantity: { type: "integer", minimum: 1 },
                    },
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        "201": { description: "Draft order created" },
        "403": { description: "Requires ADMIN or MANAGER" },
        "404": { description: "One or more products were not found" },
      },
    },
  },
  "/api/orders/{id}/confirm": {
    post: {
      summary: "Confirm a draft order and reduce product stock",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
      ],
      responses: {
        "200": { description: "Order confirmed" },
        "403": { description: "Requires ADMIN or MANAGER" },
        "404": { description: "Order not found" },
        "409": { description: "Order is not a draft or stock is insufficient" },
      },
    },
  },
};
