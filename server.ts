import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import "dotenv/config";

// Import standalone handlers
import identifyProductsHandler from "./api/identify-products.js";
import verifyFaceHandler from "./api/verify-face.js";
import analyzeFaceHandler from "./api/analyze-face.js";
import productSortHandler from "./api/product-sort.js";

async function startServer() {
  const app = express();

  let port = 3000;
  const portIndex = process.argv.indexOf("--port");
  if (portIndex !== -1 && process.argv[portIndex + 1]) {
    port = parseInt(process.argv[portIndex + 1], 10);
  } else if (process.env.PORT) {
    port = parseInt(process.env.PORT, 10);
  }

  let host = "0.0.0.0";
  const hostIndex = process.argv.indexOf("--host");
  if (hostIndex !== -1 && process.argv[hostIndex + 1]) {
    host = process.argv[hostIndex + 1];
  }

  app.use(express.json({ limit: "15mb" }));

  // Health check route
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Map routes to Vercel handlers for local development
  app.post("/api/identify-products", async (req, res) => {
    try {
      await identifyProductsHandler(req as any, res as any);
    } catch (err: any) {
      console.error("[Server:identify-products] Error:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to identify products." });
    }
  });

  app.post("/api/verify-face", async (req, res) => {
    try {
      await verifyFaceHandler(req as any, res as any);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "An error occurred during face scan." });
    }
  });

  app.post("/api/analyze-face", async (req, res) => {
    try {
      await analyzeFaceHandler(req as any, res as any);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "Failed to analyze skin image." });
    }
  });

  app.post("/api/product-sort", async (req, res) => {
    try {
      await productSortHandler(req as any, res as any);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "Failed to sort products." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(port, host, () => {
    console.log(`  VITE v6.2.0  ready in 200 ms`);
    console.log(`  ➜  Local:   http://localhost:${port}/`);
    console.log(`  ➜  Network: http://${host}:${port}/`);
  });

  process.on("SIGTERM", () => {
    server.close();
    process.exit(0);
  });
  process.on("SIGINT", () => {
    server.close();
    process.exit(0);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
