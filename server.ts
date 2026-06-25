import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

// Lazy initializer for Google Gen AI
let aiClient: GoogleGenAI | null = null;
function getAi(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required to run the dermal scanner. Please configure it in your Settings > Secrets panel.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Helper to parse data URL
function parseDataUrl(dataUrl: string) {
  if (!dataUrl) return null;
  const matches = dataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)$/);
  if (!matches) return null;
  return {
    mimeType: matches[1],
    base64Data: matches[2],
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "15mb" }));

  // 1. Product Identification API using Gemini Vision
  app.post("/api/identify-products", async (req, res) => {
    try {
      const { image } = req.body;
      if (!image) {
        return res.status(400).json({ success: false, error: "No image submitted for product identification." });
      }

      const parsed = parseDataUrl(image);
      if (!parsed) {
        return res.status(400).json({ success: false, error: "Invalid image format received." });
      }

      const ai = getAi();
      const systemInstruction = "You are identifying skincare and cosmetic products from a photo.";
      const promptText = `You are identifying skincare and cosmetic products from a photo.

Look at all visible products.

Use:
* label text visible in the image
* packaging details
* OCR
* your internal knowledge

Do not use web search or external sources.

For every skincare or makeup product you can confidently identify, return:
* brand
* product name

Return valid JSON only.

If no skincare or makeup products are present, return:
{
  "products": []
}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: [
          {
            inlineData: {
              mimeType: parsed.mimeType,
              data: parsed.base64Data,
            },
          },
          {
            text: promptText,
          },
        ],
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              products: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    brand: { type: "STRING" },
                    name: { type: "STRING" }
                  },
                  required: ["brand", "name"]
                }
              }
            },
            required: ["products"]
          }
        },
      });

      const text = response.text || "";
      const result = JSON.parse(text.trim());
      return res.json({ success: true, products: result.products || [] });

    } catch (err: any) {
      console.error("Error in /api/identify-products:", err);
      return res.status(500).json({ success: false, error: err.message || "Failed to identify products." });
    }
  });

  // 1. Face verification API (used during upload)
  app.post("/api/verify-face", async (req, res) => {
    try {
      const { image } = req.body;
      if (!image) {
        return res.status(400).json({ success: false, error: "No image submitted for verification." });
      }

      // If it's a demo photo (using Unsplash URL directly), treat as verified bypass
      if (typeof image === "string" && image.startsWith("http")) {
        return res.json({ success: true, face_detected: true, face_too_small: false });
      }

      const parsed = parseDataUrl(image);
      if (!parsed) {
        return res.status(400).json({ success: false, error: "Invalid image format received." });
      }

      const ai = getAi();
      const systemInstruction =
        "You are a professional medical imaging and aesthetic facial recognition assistant. Your task is to detect the presence of a face and evaluate its size relative to the frame.";

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          {
            inlineData: {
              mimeType: parsed.mimeType,
              data: parsed.base64Data,
            },
          },
          {
            text: `Analyze this image. You must determine if there is a human face, and if it is too small (e.g., if the face takes up less than approximately 35%-40% of the total height/width of the image).
Respond ONLY with a valid JSON object. Do not wrap in markdown or backticks.

JSON schema:
{
  "face_detected": boolean,
  "face_too_small": boolean,
  "explanation": "Professional user feedback string. (e.g. 'No human face could be identified. Please make sure you are in a brightly lit environment and looking directly into the lens.' or 'Your face was detected but appears too small. Please position the camera closer or crop the image so your face fills at least 40% of the frame.')"
}`,
          },
        ],
        config: {
          systemInstruction,
          responseMimeType: "application/json",
        },
      });

      const text = response.text || "";
      const result = JSON.parse(text.trim());
      return res.json({ success: true, ...result });

    } catch (err: any) {
      console.error("Error verifying face:", err);
      return res.status(500).json({ success: false, error: err.message || "An error occurred during face scan." });
    }
  });

  // 2. Comprehensive Skin AI Scan API
  app.post("/api/analyze-face", async (req, res) => {
    try {
      const { frontImage, closeUpImage, userAnswers } = req.body;
      if (!frontImage) {
        return res.status(400).json({ success: false, error: "A front-facing photo is required for skin analysis." });
      }

      // Bypass verification for standard unsplash fallback urls
      const isDemoUrl = typeof frontImage === "string" && frontImage.startsWith("http");

      const frontParsed = parseDataUrl(frontImage);
      const closeUpParsed = closeUpImage ? parseDataUrl(closeUpImage) : null;

      const age = userAnswers?.age || "Unknown";
      const sensitivity = userAnswers?.sensitivity || [];
      const goals = userAnswers?.goals || [];
      const breakoutType = userAnswers?.breakoutType || [];

      const ai = getAi();
      const systemInstruction =
        "You are a professional board-certified clinical dermatologist assistant and medical facial recognition scanner. Your first priority is verifying that a human face is present and of adequate size, then performing objective redness, wrinkles, and comedonal/papular acne classification.";

      const promptText = `Analyze the provided front-facing photo (and close-up photo if provided) for clinical face verification AND dermal features.

Verify the following:
1. Is a human face identified/present in the front-facing photo? Set "face_detected" to true/false.
2. Is the face too small for a high-accuracy aesthetic analysis? (e.g. if the face/facial contour occupies less than about 35%-40% of the width or height of the total photo). Set "face_too_small" to true/false. Note: for professional stock/model demo URLs, this is always false.

If a human face is NOT present, or is too small, provide a helpful dermatologist instruction in "explanation" describing what the user should do (e.g. center the face, brighten lighting, move closer) and return default/placeholder values (0 for scores, "None" for areas/acne).
Otherwise, set "face_detected": true, "face_too_small": false, "explanation": "" and perform full skin assessment using the following context:
- Age: ${age}
- Sensitivity & Redness logs: ${JSON.stringify(sensitivity)}
- Goals: ${JSON.stringify(goals)}
- Breakout types noted: ${JSON.stringify(breakoutType)}

Determine parameters:
1. Redness Intensity: Rating from 0 (completely calm) to 100 (intense redness/erythema/inflammation/rosacea). Ground this in actual redness visible in the photo.
2. Wrinkle Density: Rating from 0 (perfectly smooth) to 100 (severe deep lines). Frame this realistically based on visible wrinkles, or age group if normal.
3. Primary Redness Area: Which zone has the most intense redness? Must choose exactly one of: 'Cheeks', 'Forehead', 'T-zone', 'Chin', 'None'.
4. Primary Wrinkle Area: Which zone shows the most wrinkles? Must choose exactly one of: 'Periorbital', 'Forehead', 'Nasolabial', 'None'.
5. Acne Classification: Diagnose current comedonal or inflammatory acne patterns. Must choose exactly one of: 'None', 'Open Comedones', 'Closed Comedones', 'Post-Inflammatory Erythema', 'Post-Inflammatory Hyperpigmentation', 'Papules', 'Cluster of red bumps (Conglobate / Acne Rash)', 'Pustules', 'Nodules', 'Cystic Acne'.

Return ONLY a JSON response conforming to this exact schema (no markdown wrapping, no backticks, no "json" label):
{
  "face_detected": boolean,
  "face_too_small": boolean,
  "explanation": string,
  "redness_score": number, // integer 0-100
  "wrinkles_score": number, // integer 0-100
  "redness_main_area": "Cheeks" | "Forehead" | "T-zone" | "Chin" | "None",
  "wrinkels_main_area": "Periorbital" | "Forehead" | "Nasolabial" | "None",
  "scan_acne_type": "None" | "Open Comedones" | "Closed Comedones" | "Post-Inflammatory Erythema" | "Post-Inflammatory Hyperpigmentation" | "Papules" | "Cluster of red bumps (Conglobate / Acne Rash)" | "Pustules" | "Nodules" | "Cystic Acne"
}`;

      const contentsParts: any[] = [];
      if (frontParsed) {
        contentsParts.push({
          inlineData: {
            mimeType: frontParsed.mimeType,
            data: frontParsed.base64Data,
          },
        });
      } else if (isDemoUrl) {
        contentsParts.push({ text: `Analyzing skin for demo user. Demo photo is Unsplash image: ${frontImage}` });
      }

      if (closeUpParsed) {
        contentsParts.push({
          inlineData: {
            mimeType: closeUpParsed.mimeType,
            data: closeUpParsed.base64Data,
          },
        });
      }

      contentsParts.push({ text: promptText });

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: contentsParts,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
        },
      });

      const text = response.text || "";
      const result = JSON.parse(text.trim());

      // Override for demo URLs to ensure they always pass verification successfully
      if (isDemoUrl) {
        result.face_detected = true;
        result.face_too_small = false;
        result.explanation = "";
      }

      return res.json({ success: true, ...result });

    } catch (err: any) {
      console.error("Error in /api/analyze-face:", err);
      return res.status(500).json({ success: false, error: err.message || "Failed to analyze skin image." });
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
