import assert from "node:assert/strict";
import type { Server } from "node:http";
import { after, before, test } from "node:test";
import { app } from "./app.js";

let server: Server;

before(async () => {
  server = await new Promise<Server>((resolve) => {
    const listeningServer = app.listen(0, "127.0.0.1", () => {
      resolve(listeningServer);
    });
  });
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

function apiUrl(path: string) {
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Test server address is unavailable");
  }

  return `http://127.0.0.1:${address.port}${path}`;
}

test("GET /health returns the API health response", async () => {
  const response = await fetch(apiUrl("/health"));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, "ok");
  assert.equal(body.service, "mini-erp");
  assert.equal(body.instance, "local");
  assert.equal(typeof body.timestamp, "string");
});

test("GET /api/auth/me rejects a request without an access token", async () => {
  const response = await fetch(apiUrl("/api/auth/me"));

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: "Authorization header missing",
  });
});

test("GET /metrics exposes Prometheus HTTP metrics", async () => {
  const response = await fetch(apiUrl("/metrics"));
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/plain/);
  assert.match(body, /mini_erp_http_request_duration_seconds/);
  assert.match(body, /route="\/health"/);
});
