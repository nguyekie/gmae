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
import { setupSockets } from "./sockets/index.js";

dotenv.config();

const app = express();
const httpServer = createServer(app);

const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
app.use(cors({ origin: clientOrigin }));
app.use(express.json());

const io = setupSockets(httpServer, clientOrigin);

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

// Middleware bắt lỗi chung — luôn đặt cuối cùng
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Đã xảy ra lỗi không mong muốn phía server" });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Etheria server đang chạy tại http://localhost:${PORT}`);
});
