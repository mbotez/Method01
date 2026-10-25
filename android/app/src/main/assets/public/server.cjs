var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_config2 = require("dotenv/config");

// api/_utils.ts
var import_genai = require("@google/genai");
var import_config = require("dotenv/config");
var aiClient = null;
function getAi() {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required to run the dermal scanner. Please configure it in your Settings > Secrets panel.");
    }
    aiClient = new import_genai.GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return aiClient;
}
function parseDataUrl(dataUrl) {
  if (!dataUrl) return null;
  const matches = dataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)$/);
  if (!matches) return null;
  return {
    mimeType: matches[1],
    base64Data: matches[2]
  };
}
function handleCors(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return true;
  }
  return false;
}

// api/identify-products.ts
async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }
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
            data: parsed.base64Data
          }
        },
        {
          text: promptText
        }
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
      }
    });
    const text = response.text || "";
    console.log("=== GEMINI VISION RAW API RESPONSE TEXT & SCHEMA ===");
    console.log("Raw Response Text:", text);
    const result = JSON.parse(text.trim());
    console.log("Parsed JSON Result Schema:", JSON.stringify(result, null, 2));
    console.log("====================================================");
    const identifiedProducts = result.products || [];
    console.log("Gemini Vision identified products on server:", identifiedProducts);
    return res.json({ success: true, products: identifiedProducts });
  } catch (err) {
    console.error("Error in /api/identify-products:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to identify products." });
  }
}

// api/verify-face.ts
async function handler2(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ success: false, error: "No image submitted for verification." });
    }
    if (typeof image === "string" && image.startsWith("http")) {
      return res.json({ success: true, face_detected: true, face_too_small: false });
    }
    const parsed = parseDataUrl(image);
    if (!parsed) {
      return res.status(400).json({ success: false, error: "Invalid image format received." });
    }
    const ai = getAi();
    const systemInstruction = "You are a professional medical imaging and aesthetic facial recognition assistant. Your task is to detect the presence of a face and evaluate its size relative to the frame.";
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: parsed.mimeType,
            data: parsed.base64Data
          }
        },
        {
          text: `Analyze this image. You must determine if there is a human face, and if it is too small (e.g., if the face takes up less than approximately 35%-40% of the total height/width of the image).
Respond ONLY with a valid JSON object. Do not wrap in markdown or backticks.

JSON schema:
{
  "face_detected": boolean,
  "face_too_small": boolean,
  "explanation": "Professional user feedback string. (e.g. 'No human face could be identified. Please make sure you are in a brightly lit environment and looking directly into the lens.' or 'Your face was detected but appears too small. Please position the camera closer or crop the image so your face fills at least 40% of the frame.')"
}`
        }
      ],
      config: {
        systemInstruction,
        responseMimeType: "application/json"
      }
    });
    const text = response.text || "";
    const result = JSON.parse(text.trim());
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error("Error verifying face:", err);
    return res.status(500).json({ success: false, error: err.message || "An error occurred during face scan." });
  }
}

// api/analyze-face.ts
async function handler3(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }
  try {
    const { frontImage, closeUpImage, userAnswers } = req.body;
    if (!frontImage) {
      return res.status(400).json({ success: false, error: "A front-facing photo is required for skin analysis." });
    }
    const isDemoUrl = typeof frontImage === "string" && frontImage.startsWith("http");
    const frontParsed = parseDataUrl(frontImage);
    const closeUpParsed = closeUpImage ? parseDataUrl(closeUpImage) : null;
    const age = userAnswers?.age || "Unknown";
    const sensitivity = userAnswers?.sensitivity || [];
    const goals = userAnswers?.goals || [];
    const rawBreakoutType = userAnswers?.breakoutType || [];
    const BREAKOUT_MAP = {
      1: "Surface Whiteheads",
      2: "Surface Blackheads",
      3: "Post-Blemish Red Marks",
      4: "Post-Blemish Dark Spots",
      5: "Surface Bumps",
      6: "General Congestion",
      7: "Surface Blemishes",
      8: "Deep & Tender Bumps",
      "whiteheads": "Surface Whiteheads",
      "surface whiteheads": "Surface Whiteheads",
      "closed surface pores": "Surface Whiteheads",
      "closed pores": "Surface Whiteheads",
      "blackheads": "Surface Blackheads",
      "surface blackheads": "Surface Blackheads",
      "open surface pores": "Surface Blackheads",
      "open pores": "Surface Blackheads",
      "pie": "Post-Blemish Red Marks",
      "post-blemish red marks": "Post-Blemish Red Marks",
      "red marks": "Post-Blemish Red Marks",
      "pih": "Post-Blemish Dark Spots",
      "post-blemish dark spots": "Post-Blemish Dark Spots",
      "dark spots": "Post-Blemish Dark Spots",
      "surface bumps": "Surface Bumps",
      "surface breakouts": "Surface Bumps",
      "congestion": "General Congestion",
      "general congestion": "General Congestion",
      "deep breakouts": "General Congestion",
      "surface blemishes": "Surface Blemishes",
      "blemishes": "Surface Blemishes",
      "deep & tender bumps": "Deep & Tender Bumps",
      "deep and tender bumps": "Deep & Tender Bumps"
    };
    const breakoutArr = Array.isArray(rawBreakoutType) ? rawBreakoutType : rawBreakoutType ? [rawBreakoutType] : [];
    const breakoutDescriptions = breakoutArr.filter((b) => b && b !== "none").map((b) => BREAKOUT_MAP[b] || (BREAKOUT_MAP[Number(b)] || String(b)));
    const ai = getAi();
    const systemInstruction = "You are an AI cosmetic and skin aesthetic assistant analyzing surface texture, pore congestion, excess oiliness, and tone variation for cosmetic product matching.";
    const promptText = `Analyze the provided front-facing photo (and close-up photo if provided) for face verification AND cosmetic skin features.

Verify the following:
1. Is a human face identified/present in the front-facing photo? Set "face_detected" to true/false.
2. Is the face too small for a high-accuracy aesthetic analysis? (e.g. if the face/facial contour occupies less than about 35%-40% of the width or height of the total photo). Set "face_too_small" to true/false. Note: for professional stock/model demo URLs, this is always false.

If a human face is NOT present, or is too small, provide a helpful guidance instruction in "explanation" describing what the user should do (e.g. center the face, brighten lighting, move closer) and return default/placeholder values (0 for scores, "None" for areas).
Otherwise, set "face_detected": true, "face_too_small": false, "explanation": "" and perform full cosmetic skin assessment using the following context:
- Age: ${age}
- Sensitivity & Redness logs: ${JSON.stringify(sensitivity)}
- Goals: ${JSON.stringify(goals)}
- Blemish / Congestion notes: ${JSON.stringify(breakoutDescriptions.length > 0 ? breakoutDescriptions : "None specified")}

Determine parameters:
1. Redness Intensity: Rating from 0 (completely calm) to 100 (intense surface redness/sensitivity). Ground this in actual redness visible in the photo.
2. Wrinkle Density: Rating from 0 (perfectly smooth) to 100 (prominent expression lines). Frame this realistically based on visible surface lines.
3. Primary Redness Area: Which zone has the most intense redness? Must choose exactly one of: 'Cheeks', 'Forehead', 'T-zone', 'Chin', 'None'.
4. Primary Wrinkle Area: Which zone shows the most surface lines? Must choose exactly one of: 'Periorbital', 'Forehead', 'Nasolabial', 'None'.
5. Congestion & Blemish Assessment: Evaluate surface pore congestion, blackheads/whiteheads, post-blemish dark/red marks, and surface bumps. Must choose exactly one of: 'None', 'Open Surface Pores', 'Closed Surface Pores', 'Post-Blemish Red Marks', 'Post-Blemish Dark Spots', 'Surface Bumps', 'General Congestion', 'Deep & Tender Bumps'.

Return ONLY a JSON response conforming to this exact schema (no markdown wrapping, no backticks, no "json" label):
{
  "face_detected": boolean,
  "face_too_small": boolean,
  "explanation": string,
  "redness_score": number, // integer 0-100
  "wrinkles_score": number, // integer 0-100
  "redness_main_area": "Cheeks" | "Forehead" | "T-zone" | "Chin" | "None",
  "wrinkels_main_area": "Periorbital" | "Forehead" | "Nasolabial" | "None",
  "blemish_assessment": "None" | "Open Surface Pores" | "Closed Surface Pores" | "Post-Blemish Red Marks" | "Post-Blemish Dark Spots" | "Surface Bumps" | "General Congestion" | "Deep & Tender Bumps"
}`;
    const contentsParts = [];
    if (frontParsed) {
      contentsParts.push({
        inlineData: {
          mimeType: frontParsed.mimeType,
          data: frontParsed.base64Data
        }
      });
    } else if (isDemoUrl) {
      contentsParts.push({ text: `Analyzing skin for demo user. Demo photo is Unsplash image: ${frontImage}` });
    }
    if (closeUpParsed) {
      contentsParts.push({
        inlineData: {
          mimeType: closeUpParsed.mimeType,
          data: closeUpParsed.base64Data
        }
      });
    }
    contentsParts.push({ text: promptText });
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: contentsParts,
      config: {
        systemInstruction,
        responseMimeType: "application/json"
      }
    });
    const text = response.text || "";
    const result = JSON.parse(text.trim());
    if (isDemoUrl) {
      result.face_detected = true;
      result.face_too_small = false;
      result.explanation = "";
    }
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error("Error in /api/analyze-face:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to analyze skin image." });
  }
}

// api/product-sort.ts
var import_supabase_js = require("@supabase/supabase-js");
async function handler4(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }
  try {
    const { userProfile, productType, page = 1, cat3 = null } = req.body;
    if (!userProfile) {
      return res.status(400).json({ success: false, error: "Missing userProfile in request body" });
    }
    const LIMIT_PER_PAGE = 30;
    const offset = (page - 1) * LIMIT_PER_PAGE;
    const barrier_status_effective = userProfile.new_product_reaction === 3 ? 8 : userProfile.barrier_status || 0;
    const barrier_level = barrier_status_effective <= 3 ? "low" : barrier_status_effective <= 6 ? "medium" : "high";
    const route = barrier_level === "high" ? 1 : 2;
    const skin_type = userProfile.skin_type || "normal";
    const main_concern = userProfile.main_concern || null;
    const secondary_concern = userProfile.scnd_concern || null;
    const breakoutTypeStringToId = {
      // Option 1: Surface Whiteheads
      "whiteheads": 1,
      "surface whiteheads": 1,
      "closed surface pores": 1,
      "closed pores": 1,
      // Option 2: Surface Blackheads
      "blackheads": 2,
      "surface blackheads": 2,
      "open surface pores": 2,
      "open pores": 2,
      // Option 3: Post-Blemish Red Marks
      "pie": 3,
      "post-blemish red marks": 3,
      "red marks": 3,
      // Option 4: Post-Blemish Dark Spots
      "pih": 4,
      "post-blemish dark spots": 4,
      "dark spots": 4,
      // Option 5: Surface Bumps
      "surface bumps": 5,
      "surface breakouts": 5,
      // Option 6: General Congestion
      "congestion": 6,
      "general congestion": 6,
      "deep breakouts": 6,
      // Option 7: Surface Blemishes
      "surface blemishes": 7,
      "blemishes": 7,
      // Option 8: Deep & Tender Bumps
      "deep & tender bumps": 8,
      "deep and tender bumps": 8
    };
    const rawBreakouts = Array.isArray(userProfile.breakout_type) ? userProfile.breakout_type : userProfile.breakout_type ? [userProfile.breakout_type] : [];
    const breakout_type = rawBreakouts.map((b) => {
      if (typeof b === "number") return b;
      const parsed = parseInt(String(b), 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 8) return parsed;
      return breakoutTypeStringToId[String(b).toLowerCase().trim()] || 0;
    }).filter((n) => n >= 1 && n <= 8);
    const scan_breakout_type = Array.isArray(userProfile.scan_breakout_type) ? userProfile.scan_breakout_type : Array.isArray(userProfile.blemish_assessment) ? userProfile.blemish_assessment : userProfile.blemish_assessment ? [userProfile.blemish_assessment] : userProfile.scan_breakout_type ? [userProfile.scan_breakout_type] : [];
    const pregnant = userProfile.pregnant === "Yes" ? "Yes" : "No";
    const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
    const supabase = (0, import_supabase_js.createClient)(supabaseUrl, supabaseAnonKey);
    console.log("[product-sort API] --- STARTING PRODUCT SORT ---");
    console.log("[product-sort API] Input Profile:", { skin_type, main_concern, secondary_concern, barrier_level, productType, cat3, page, offset });
    let rawProducts = null;
    let rawLockedProducts = null;
    let rpcError = null;
    try {
      if (barrier_level === "high") {
        const { data: safeData, error: safeError } = await supabase.rpc("get_meli_product_sort", {
          p_barrier_status: userProfile.barrier_status || 0,
          p_breakout_type: breakout_type,
          p_main_concern: main_concern,
          p_new_product_reaction: userProfile.new_product_reaction || 0,
          p_pregnant: pregnant,
          p_product_type: productType,
          p_scan_breakout_type: scan_breakout_type,
          p_scnd_concern: secondary_concern,
          p_skin_type: skin_type,
          p_limit: LIMIT_PER_PAGE,
          p_offset: offset,
          p_cat3: cat3
        });
        if (safeError) throw safeError;
        rawProducts = safeData;
        const { data: lockedData, error: lockedError } = await supabase.rpc("get_meli_product_sort", {
          p_barrier_status: 3,
          p_breakout_type: breakout_type,
          p_main_concern: main_concern,
          p_new_product_reaction: 0,
          p_pregnant: pregnant,
          p_product_type: productType,
          p_scan_breakout_type: scan_breakout_type,
          p_scnd_concern: secondary_concern,
          p_skin_type: skin_type,
          p_limit: LIMIT_PER_PAGE,
          p_offset: offset,
          p_cat3: cat3
        });
        if (lockedError) throw lockedError;
        const safeIds = new Set((rawProducts || []).map((p) => p.product_id));
        rawLockedProducts = (lockedData || []).filter((p) => !safeIds.has(p.product_id));
      } else {
        const { data, error } = await supabase.rpc("get_meli_product_sort", {
          p_barrier_status: userProfile.barrier_status || 0,
          p_breakout_type: breakout_type,
          p_main_concern: main_concern,
          p_new_product_reaction: userProfile.new_product_reaction || 0,
          p_pregnant: pregnant,
          p_product_type: productType,
          p_scan_breakout_type: scan_breakout_type,
          p_scnd_concern: secondary_concern,
          p_skin_type: skin_type,
          p_limit: LIMIT_PER_PAGE,
          p_offset: offset,
          p_cat3: cat3
        });
        if (error) throw error;
        rawProducts = data;
        rawLockedProducts = [];
      }
    } catch (e) {
      rpcError = e;
    }
    if (rpcError) {
      console.warn("[product-sort API] Database RPC failed, engaging direct query fallback:", rpcError.message);
      try {
        let baseQuery = supabase.from("products").select("id, brand, name, type, photo_url, product_scores!inner(*)");
        if (productType && productType !== "all") {
          baseQuery = baseQuery.ilike("type", `%${productType}%`);
        }
        if (cat3 !== null && cat3 !== void 0) {
          baseQuery = baseQuery.eq("product_scores.cat3", cat3);
        }
        if (pregnant === "Yes") {
          baseQuery = baseQuery.eq("product_scores.pregnancy_safe", true);
        }
        const { data: dbData, error: dbError } = await baseQuery.range(offset, offset + LIMIT_PER_PAGE - 1);
        if (dbError) throw dbError;
        const formatted = (dbData || []).map((p) => {
          const s = p.product_scores || {};
          return {
            product_id: p.id,
            name: p.name,
            product_name: p.name,
            brand: p.brand,
            type: p.type,
            photo_url: p.photo_url,
            cat2: s.cat2,
            cat3: s.cat3,
            scores: s,
            clear_surface_breakouts: s.clear_surface_breakouts || 0,
            soothe_deep_breakouts: s.soothe_deep_breakouts || 0,
            synergy_breakout_response: s.synergy_breakout_response || 0,
            synergy_deep_breakout_penetration: s.synergy_deep_breakout_penetration || 0,
            has_purifying_active: s.has_purifying_active || false,
            is_prescription: false
          };
        });
        if (barrier_level === "high") {
          rawProducts = formatted.filter((p) => !p.scores?.has_high_irritation);
          rawLockedProducts = formatted.filter((p) => p.scores?.has_high_irritation);
        } else {
          rawProducts = formatted;
          rawLockedProducts = [];
        }
      } catch (fallbackErr) {
        console.error("[product-sort API] Fallback query failed as well:", fallbackErr);
        return res.status(500).json({
          success: false,
          error: fallbackErr.message || "Failed to query products from database"
        });
      }
    }
    const filteredProducts = rawProducts || [];
    const lockedProductsList = rawLockedProducts || [];
    console.log(`[product-sort API] Returned ${filteredProducts.length} products and ${lockedProductsList.length} locked products for page ${page}.`);
    const standardProducts = filteredProducts.filter((p) => !p.is_prescription);
    const prescriptionProducts = filteredProducts.filter((p) => p.is_prescription);
    const alerts = [];
    if (barrier_level === "high") {
      alerts.push("Your barrier needs recovery \u2014 actives paused for now");
    }
    return res.status(200).json({
      success: true,
      route,
      barrier_level,
      products: standardProducts,
      locked_products: lockedProductsList,
      prescriptions: prescriptionProducts,
      alerts,
      meta: {
        currentPage: page,
        itemsReturned: filteredProducts.length
      }
    });
  } catch (error) {
    console.error("product-sort handler error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error in product-sort",
      details: error.stack
    });
  }
}

// server.ts
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json({ limit: "15mb" }));
  app.post("/api/identify-products", async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      console.error("Local Dev Server Error in identify-products:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to identify products." });
    }
  });
  app.post("/api/verify-face", async (req, res) => {
    try {
      await handler2(req, res);
    } catch (err) {
      console.error("Local Dev Server Error in verify-face:", err);
      res.status(500).json({ success: false, error: err.message || "An error occurred during face scan." });
    }
  });
  app.post("/api/analyze-face", async (req, res) => {
    try {
      await handler3(req, res);
    } catch (err) {
      console.error("Local Dev Server Error in analyze-face:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to analyze skin image." });
    }
  });
  app.post("/api/product-sort", async (req, res) => {
    try {
      await handler4(req, res);
    } catch (err) {
      console.error("Local Dev Server Error in product-sort:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to sort products." });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
