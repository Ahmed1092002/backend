const productIdParameter = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "string", format: "uuid" },
};

export const productPaths = {
  "/api/products": {
    get: {
      summary: "List products",
      parameters: [
        { name: "page", in: "query", schema: { type: "integer", default: 1 } },
        { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 } },
        { name: "search", in: "query", schema: { type: "string" } },
      ],
      responses: { "200": { description: "Paginated products" } },
    },
    post: {
      summary: "Create a product",
      requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["name", "price"], properties: { name: { type: "string" }, price: { type: "number", minimum: 0 }, stock: { type: "integer", minimum: 0, default: 0 } } } } } },
      responses: { "201": { description: "Product created" }, "400": { description: "Invalid input" } },
    },
  },
  "/api/products/{id}": {
    get: { summary: "Get one product", parameters: [productIdParameter], responses: { "200": { description: "Product" }, "404": { description: "Not found" } } },
    patch: { summary: "Update a product", parameters: [productIdParameter], responses: { "200": { description: "Product updated" }, "404": { description: "Not found" } } },
    delete: { summary: "Delete a product", parameters: [productIdParameter], responses: { "204": { description: "Product deleted" }, "404": { description: "Not found" } } },
  },
  "/api/products/{id}/image": {
    post: { summary: "Upload a product image", security: [{ bearerAuth: [] }], parameters: [productIdParameter], requestBody: { required: true, content: { "multipart/form-data": { schema: { type: "object", required: ["image"], properties: { image: { type: "string", format: "binary" } } } } } }, responses: { "200": { description: "Image uploaded" }, "403": { description: "Requires ADMIN or MANAGER" } } },
  },
  "/api/products/{id}/stock-adjustments": {
    post: {
      summary: "Adjust product stock and record the movement",
      security: [{ bearerAuth: [] }],
      parameters: [productIdParameter],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["delta"],
              properties: {
                delta: { type: "integer", example: -2 },
                note: { type: "string", example: "Sold at counter" },
              },
            },
          },
        },
      },
      responses: {
        "200": { description: "Stock adjusted" },
        "403": { description: "Requires ADMIN or MANAGER" },
        "409": { description: "Adjustment would make stock negative" },
      },
    },
  },
  "/api/products/{id}/stock-movements": {
    get: {
      summary: "List stock movement history for a product",
      security: [{ bearerAuth: [] }],
      parameters: [
        productIdParameter,
        { name: "page", in: "query", schema: { type: "integer", default: 1 } },
        { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
      ],
      responses: {
        "200": { description: "Paginated stock movements" },
        "403": { description: "Requires ADMIN or MANAGER" },
        "404": { description: "Product not found" },
      },
    },
  },
};
