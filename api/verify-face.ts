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
}
