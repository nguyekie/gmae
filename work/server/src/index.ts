import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { authRouter } from "./routes/auth.js";
import { characterRouter } from "./routes/character.js";
import { inventoryRouter } from "./routes/inventory.js";
import { buildMarketplaceRouter } from "./routes/marketplace.js";
import { buildCombatRouter } from "./routes/combat.js";
import { questRouter } from "./routes/quest.js";
import { friendsRouter } from "./routes/friends.js";
import { chatRouter } from "./routes/chat.js";
import { shopRouter } from "./routes/shop.js";
import { craftingRouter } from "./routes/crafting.js";
import { companionsRouter } from "./routes/companions.js";
import { dailyTasksRouter } from "./routes/dailyTasks.js";
import { autoFarmRouter } from "./routes/autoFarm.js";
import { setupSockets } from "./sockets/index.js";

dotenv.config();

const app = express();
const httpServer = createServer(app);

const localClientOrigins: string[] = ["http://localhost:5173", "http://127.0.0.1:5173"];
const configuredClientOrigins = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((origin: string) => origin.trim())
  .filter((origin: string) => Boolean(origin));
const clientOrigins: string[] =
  configuredClientOrigins.length > 0 ? configuredClientOrigins : localClientOrigins;
const corsOrigin = configuredClientOrigins.length > 0 || process.env.NODE_ENV === "production" ? clientOrigins : true;

if (clientOrigins.some((origin) => localClientOrigins.includes(origin))) {
  for (const origin of localClientOrigins) {
    if (!clientOrigins.includes(origin)) clientOrigins.push(origin);
  }
}

app.use(cors({ origin: corsOrigin }));
app.use(express.json());

const io = setupSockets(httpServer, corsOrigin);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRouter);
app.use("/api/characters", characterRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/marketplace", buildMarketplaceRouter(io));
app.use("/api/combat", buildCombatRouter(io));
app.use("/api/quests", questRouter);
app.use("/api/friends", friendsRouter);
app.use("/api/chat", chatRouter);
app.use("/api/shops", shopRouter);
app.use("/api/crafting", craftingRouter);
app.use("/api/companions", companionsRouter);
app.use("/api/daily-tasks", dailyTasksRouter);
app.use("/api/auto-farm", autoFarmRouter);

// Middleware bắt lỗi chung — luôn đặt cuối cùng
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Đã xảy ra lỗi không mong muốn phía server" });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Etheria server đang chạy tại http://localhost:${PORT}`);
});
