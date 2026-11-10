import { app } from "./app.js";

const port = 3000;

app.listen(port, "0.0.0.0", () => {
  console.log(`API disponible en http://localhost:${port}/api/v1/health`);
});