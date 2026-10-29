import "dotenv/config";
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3001);
createApp().listen(port, () => console.log(`Bookmark API listening at http://localhost:${port}`));
