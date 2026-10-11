import { createServer } from "node:http";
import { app } from "./app.js";
import { initializeSocket } from "./realtime/socket.js";

const port = Number(process.env.PORT ?? 3000);

const server = createServer(app);
initializeSocket(server);

server.listen(port, () => {
  console.log(`Server listening at http://127.0.0.1:${port}`);
});
