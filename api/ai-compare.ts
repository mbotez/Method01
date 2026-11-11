import { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { getAi, handleCors, extractErrorMessage } from "./_utils.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { userId, productIds } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, error: "Authentication required to use AI product comparison." });
    }
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ success: false, error: "Please select between 1 and 10 products to compare." });
    }
    if (productIds.length > 10) {
      return res.status(400).json({ success: false, error: "You can compare a maximum of 10 products at a time." });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://stbperzlmmslrkdpqawt.supabase.co';
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0YnBlcnpsbW1zbHJrZHBxYXd0Iiwicm9sZSI6ImFub24iOjE3NzczNjk5ODMsImV4cCI6MjA5Mjk0NTk4M30.37UW8BgKqbuw8XfcfY3zWWxkVv44_A0nJng0yDsudx8';
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // 1. Rate Limit Check & Enforcement (3 comparisons per calendar day)
    const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    let currentUsageCount = 0;
    const { data: profileData, error: profileError } = await supabase
      .from('user_profile')
      .select('skin_type, main_concern, scnd_concern, barrier_status, barrier_health, actives_used, skin_characteristics, comparison_usage')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.warn("[AI Compare] Error fetching user profile for rate limit:", profileError);
    }

    const usageObj = (profileData as any)?.comparison_usage || { date: '', count: 0 };
    if (usageObj.date === todayStr) {
      currentUsageCount = usageObj.count || 0;
    }

    if (currentUsageCount >= 3) {
      return res.status(429).json({
        success: false,
        limitReached: true,
        error: "You have reached your daily limit of 3 AI product comparisons. Please check back tomorrow!",
        remaining: 0
      });
    }

    // 2. Fetch Data from Supabase
    // Products metadata
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('id, brand, name, type, photo_url')
      .in('id', productIds);

    if (productsError) {
      throw new Error(`Failed to fetch products: ${productsError.message}`);
    }

    // Product scores & categories
    const { data: scoresData, error: scoresError } = await supabase
      .from('product_scores')
      .select('*')
      .in('product_id', productIds);

    if (scoresError) {
      console.warn("[AI Compare] Error fetching product scores:", scoresError);
    }

    // Product ingredients
    const { data: ingredientsData, error: ingredientsError } = await supabase
      .from('product_ingredients')
      .select('product_id, "Full name", ingredient, position')
      .in('product_id', productIds);

    if (ingredientsError) {
      console.warn("[AI Compare] Error fetching product ingredients:", ingredientsError);
    }

    // 3. Assemble context for Gemini 3.1 Flash Lite
    const userProfileContext = profileData || { skin_type: 'normal', main_concern: 'General maintenance' };
    
    const enrichedProducts = (productsData || []).map((p: any) => {
      const score = (scoresData || []).find((s: any) => s.product_id === p.id) || {};
      const ingList = (ingredientsData || [])
        .filter((i: any) => i.product_id === p.id)
        .sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
        .map((i: any) => i.ingredient || i["Full name"])
        .filter(Boolean);

      return {
        id: p.id,
        brand: p.brand,
        name: p.name,
        type: p.type,
        category: score.cat2 || p.type || 'General',
        scores: score,
        ingredients: ingList.slice(0, 30) // top 30 key ingredients for review
      };
    });

    const ai = getAi();
    const systemInstruction = `You are a pragmatic 24-year-old beauty editor: knowledgeable, direct, and conversational. You test formulas and check ingredient decks yourself. You write with clear, functional, literal prose without fluff, corporate marketing speak, or over-hyped enthusiasm.
Target Audience: Skincare enthusiasts who know mainstream active ingredients (e.g. niacinamide, hyaluronic acid, retinol, salicylic acid) but lack deep cosmetic chemistry or dermatological training.
Mandatory Rules:
1. NO clinical or medical jargon overkill. Avoid terms like "stratum corneum", "glycosaminoglycans", "epidermal turgor", or specific IUPAC nomenclature. Instead, use everyday terms like "outer layer of skin", "water retention", "surface bounce", and "skin elasticity".
2. NO elaborate analogies or strained metaphors (e.g. do not say "faces like construction zones" or "signing a lease on your face"). Explain mechanisms plainly and literally.
3. Ranking: Rank the selected products in order of best to worst per category ('cat2') for this specific user based on their skin profile and ingredient compatibility. Provide a short description blob for each product explaining why it is good or bad for them.
4. Grouping: If products belong to different categories ('cat2'), group them by their respective category and rank within those groups.
5. Routine Synergy: If products span different categories, assess and explain which ones pair well together in the same routine and flag any potential active ingredient conflicts (e.g., strong retinoids vs exfoliants).`;

    const prompt = `Here is the user's skin profile:
${JSON.stringify(userProfileContext, null, 2)}

Here are the selected products with their categories, scores, and key ingredient lists:
${JSON.stringify(enrichedProducts, null, 2)}

Perform the side-by-side comparison analysis adhering strictly to the voice, tone, and formatting rules.
Return ONLY a valid JSON object matching this exact TypeScript structure (no markdown code blocks, no backticks, no "json" prefix):
{
  "groups": [
    {
      "category": "string",
      "rankings": [
        {
          "product_id": number,
          "product_name": "string",
          "brand": "string",
          "rank": number,
          "score_assessment": "string",
          "verdict": "Best in category" | "Good" | "Suboptimal" | "Not recommended"
        }
      ]
    }
  ],
  "routine_synergy": {
    "pairing_advice": "string",
    "conflicts": "string",
    "recommended_order": ["string"]
  },
  "editor_summary": "string"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: [{ text: prompt }],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
      },
    });

    const responseText = response.text || "";
    let analysisResult;
    try {
      // Clean potential markdown code blocks if any
      const cleaned = responseText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "").trim();
      analysisResult = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("[AI Compare] Failed to parse JSON from Gemini:", responseText);
      throw new Error("Failed to parse AI comparison analysis output.");
    }

    // 4. Update usage count in Supabase
    const newCount = currentUsageCount + 1;
    await supabase
      .from('user_profile')
      .update({
        comparison_usage: {
          date: todayStr,
          count: newCount
        }
      })
      .eq('id', userId);

    return res.status(200).json({
      success: true,
      remaining: Math.max(0, 3 - newCount),
      analysis: analysisResult
    });

  } catch (err: any) {
    const errorMsg = extractErrorMessage(err, "Failed to complete AI product comparison.");
    console.error("[AI Compare] Error:", errorMsg);
    return res.status(500).json({ success: false, error: errorMsg });
  }
}
