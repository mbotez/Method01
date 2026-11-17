import { VercelRequest, VercelResponse } from "@vercel/node";
import { getAi, parseDataUrl, handleCors, extractErrorMessage } from "./_utils.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { image } = req.body || {};
    if (!image) {
      return res.status(400).json({ success: false, error: "No image submitted for product identification." });
    }

    const parsed = parseDataUrl(image);
    if (!parsed) {
      return res.status(400).json({ success: false, error: "Invalid image format received." });
    }

    // Fallback unsupported MIME types to image/jpeg for Gemini vision
    const supportedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    let mimeType = parsed.mimeType;
    if (!supportedMimes.includes(mimeType)) {
      mimeType = 'image/jpeg';
    }

    let ai;
    try {
      ai = getAi();
    } catch (keyErr: any) {
      return res.status(500).json({ success: false, error: keyErr.message || "Gemini AI client initialization failed." });
    }

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

    // 18-second safety timeout for AI model execution
    const geminiCall = ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: [
        {
          inlineData: {
            mimeType: mimeType,
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

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Gemini AI API generation timed out after 18 seconds.")), 18000)
    );

    const response = await Promise.race([geminiCall, timeoutPromise]);

    const text = response.text || "";
    let identifiedProducts = [];
    try {
      const result = JSON.parse(text.trim());
      identifiedProducts = result.products || [];
    } catch (parseErr: any) {
      return res.status(500).json({ success: false, error: "Failed to parse product recognition output from AI model." });
    }

    return res.json({ success: true, products: identifiedProducts });
  } catch (err: any) {
    const error = extractErrorMessage(err, "Failed to identify products.");
    return res.status(500).json({ success: false, error });
  }
}
