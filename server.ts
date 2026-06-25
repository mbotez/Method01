import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import "dotenv/config";

// Import standalone handlers
import identifyProductsHandler from "./api/identify-products.js";
import verifyFaceHandler from "./api/verify-face.js";
import analyzeFaceHandler from "./api/analyze-face.js";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "15mb" }));

  // Map routes to Vercel handlers for local development
  app.post("/api/identify-products", async (req, res) => {
    try {
      await identifyProductsHandler(req as any, res as any);
    } catch (err: any) {
      console.error("Local Dev Server Error in identify-products:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to identify products." });
    }
  });

  app.post("/api/verify-face", async (req, res) => {
    try {
      await verifyFaceHandler(req as any, res as any);
    } catch (err: any) {
      console.error("Local Dev Server Error in verify-face:", err);
      res.status(500).json({ success: false, error: err.message || "An error occurred during face scan." });
    }
  });

  app.post("/api/analyze-face", async (req, res) => {
    try {
      await analyzeFaceHandler(req as any, res as any);
    } catch (err: any) {
      console.error("Local Dev Server Error in analyze-face:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to analyze skin image." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
