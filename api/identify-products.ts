import { VercelRequest, VercelResponse } from "@vercel/node";
import { getAi, parseDataUrl, handleCors } from "./_utils.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  if (req.method !== "POST") {
    console.warn(`[API /api/identify-products] Method ${req.method} not allowed`);
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  console.log('[API /api/identify-products] Received request for product identification.');

  try {
    const { image } = req.body || {};
    if (!image) {
      console.warn('[API /api/identify-products] Missing "image" in request body');
      return res.status(400).json({ success: false, error: "No image submitted for product identification." });
    }

    const parsed = parseDataUrl(image);
    if (!parsed) {
      console.warn('[API /api/identify-products] Failed to parse Data URL format');
      return res.status(400).json({ success: false, error: "Invalid image format received." });
    }

    console.log(`[API /api/identify-products] Parsed image: MIME=${parsed.mimeType}, Base64Length=${parsed.base64Data.length}`);

    // Fallback unsupported MIME types to image/jpeg for Gemini vision
    const supportedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    let mimeType = parsed.mimeType;
    if (!supportedMimes.includes(mimeType)) {
      console.warn(`[API /api/identify-products] Unsupported MIME type ${mimeType}, falling back to image/jpeg`);
      mimeType = 'image/jpeg';
    }

    let ai;
    try {
      ai = getAi();
    } catch (keyErr: any) {
      console.error('[API /api/identify-products] AI Client initialization failed:', keyErr.message);
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

    console.log('[API /api/identify-products] Calling Gemini model gemini-3.1-flash-lite...');

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
    console.log('[API /api/identify-products] Gemini response received successfully.');

    const text = response.text || "";
    let identifiedProducts = [];
    try {
      const result = JSON.parse(text.trim());
      identifiedProducts = result.products || [];
      console.log(`[API /api/identify-products] Successfully identified ${identifiedProducts.length} product(s):`, JSON.stringify(identifiedProducts));
    } catch (parseErr: any) {
      console.error('[API /api/identify-products] Failed to parse model output JSON:', text, parseErr);
      return res.status(500).json({ success: false, error: "Failed to parse product recognition output from AI model." });
    }

    return res.json({ success: true, products: identifiedProducts });
  } catch (err: any) {
    console.error('[API /api/identify-products] Unexpected error during photo identification:', err);
    return res.status(500).json({ success: false, error: err.message || "Failed to identify products." });
  }
}
