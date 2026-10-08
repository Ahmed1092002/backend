import { app } from "./app.js";

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`Server listening at http://127.0.0.1:${port}`);
});
