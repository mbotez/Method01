import { VercelRequest, VercelResponse } from "@vercel/node";
import { getAi, parseDataUrl, handleCors } from "./_utils.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
}
