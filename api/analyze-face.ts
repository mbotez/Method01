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
}
