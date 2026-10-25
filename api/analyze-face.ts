import { VercelRequest, VercelResponse } from "@vercel/node";
import { getAi, parseDataUrl, handleCors } from "./_utils.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

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
    const rawBreakoutType = userAnswers?.breakoutType || [];
    const BREAKOUT_MAP: Record<number | string, string> = {
      1: 'Surface Whiteheads',
      2: 'Surface Blackheads',
      3: 'Post-Blemish Red Marks',
      4: 'Post-Blemish Dark Spots',
      5: 'Surface Bumps',
      6: 'General Congestion',
      7: 'Surface Blemishes',
      8: 'Deep & Tender Bumps',
      'whiteheads': 'Surface Whiteheads',
      'surface whiteheads': 'Surface Whiteheads',
      'closed surface pores': 'Surface Whiteheads',
      'closed pores': 'Surface Whiteheads',
      'blackheads': 'Surface Blackheads',
      'surface blackheads': 'Surface Blackheads',
      'open surface pores': 'Surface Blackheads',
      'open pores': 'Surface Blackheads',
      'pie': 'Post-Blemish Red Marks',
      'post-blemish red marks': 'Post-Blemish Red Marks',
      'red marks': 'Post-Blemish Red Marks',
      'pih': 'Post-Blemish Dark Spots',
      'post-blemish dark spots': 'Post-Blemish Dark Spots',
      'dark spots': 'Post-Blemish Dark Spots',
      'surface bumps': 'Surface Bumps',
      'surface breakouts': 'Surface Bumps',
      'congestion': 'General Congestion',
      'general congestion': 'General Congestion',
      'deep breakouts': 'General Congestion',
      'surface blemishes': 'Surface Blemishes',
      'blemishes': 'Surface Blemishes',
      'deep & tender bumps': 'Deep & Tender Bumps',
      'deep and tender bumps': 'Deep & Tender Bumps',
    };
    const breakoutArr = Array.isArray(rawBreakoutType) ? rawBreakoutType : (rawBreakoutType ? [rawBreakoutType] : []);
    const breakoutDescriptions = breakoutArr
      .filter((b: any) => b && b !== 'none')
      .map((b: any) => BREAKOUT_MAP[b] || (BREAKOUT_MAP[Number(b)] || String(b)));

    const ai = getAi();
    const systemInstruction =
      "You are an AI cosmetic and skin aesthetic assistant analyzing surface texture, pore congestion, excess oiliness, and tone variation for cosmetic product matching.";

    const promptText = `Analyze the provided front-facing photo (and close-up photo if provided) for face verification AND cosmetic skin features.

Verify the following:
1. Is a human face identified/present in the front-facing photo? Set "face_detected" to true/false.
2. Is the face too small for a high-accuracy aesthetic analysis? (e.g. if the face/facial contour occupies less than about 35%-40% of the width or height of the total photo). Set "face_too_small" to true/false. Note: for professional stock/model demo URLs, this is always false.

If a human face is NOT present, or is too small, provide a helpful guidance instruction in "explanation" describing what the user should do (e.g. center the face, brighten lighting, move closer) and return default/placeholder values (0 for scores, "None" for areas).
Otherwise, set "face_detected": true, "face_too_small": false, "explanation": "" and perform full cosmetic skin assessment using the following context:
- Age: ${age}
- Sensitivity & Redness logs: ${JSON.stringify(sensitivity)}
- Goals: ${JSON.stringify(goals)}
- Blemish / Congestion notes: ${JSON.stringify(breakoutDescriptions.length > 0 ? breakoutDescriptions : 'None specified')}

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
}
