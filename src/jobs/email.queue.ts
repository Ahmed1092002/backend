import { Queue } from "bullmq";
import { queueConnection } from "./connection.js";

type WelcomeEmailJob = { userId: string; name: string; email: string };

let emailQueue: Queue<WelcomeEmailJob> | undefined;

function getEmailQueue() {
  // Creating a Queue opens a Redis connection. Delay that work until a real
  // registration queues an email, so importing the Express app stays cheap
  // and API tests do not need a Redis server.
  emailQueue ??= new Queue<WelcomeEmailJob>("emails", {
    connection: queueConnection,
  });

  return emailQueue;
}

export function queueWelcomeEmail(userId: string, name: string, email: string) {
  return getEmailQueue().add("welcome", { userId, name, email }, {
    jobId: `welcome:${userId}`,
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
  });
}
