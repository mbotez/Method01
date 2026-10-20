import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, X, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ProductResultRow } from './ProductResultRow';

export interface MatchedProduct {
  id: string;
  brand: string;
  name: string;
  type: string;
  photo_url?: string;
}

// Helper to convert File to base64 Data URL
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

/**
 * Sends a product photo to Gemini Vision API, identifies products, 
 * and queries Supabase using fts_search and fallbacks to find matching database records.
 */
export async function searchProductsFromPhoto(imageFile: File): Promise<MatchedProduct[]> {
  const base64 = await fileToBase64(imageFile);

  // Call server-side API to identify products with a timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout for AI

  let response;
  try {
    response = await fetch("/api/identify-products", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ image: base64 }),
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error("Product identification timed out. Please try again with a clearer photo.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || "Failed to identify products from photo.");
  }

  const data = await response.json();
  console.log("=== PHOTO SEARCH RESPONSE SCHEMA & DATA (MATCHED WITH SUPABASE) ===");
  console.log("Raw API Response Object:", JSON.stringify(data, null, 2));
  console.log("Response Schema Type:", typeof data, "Keys:", Object.keys(data));
  if (data.products) {
    console.log("Products Array Schema/Length:", data.products.length);
    data.products.forEach((p: any, i: number) => {
      console.log(`Product [${i}] Schema Keys:`, Object.keys(p), "Values:", p);
    });
  }
  console.log("===============================================================");

  if (!data.success) {
    throw new Error(data.error || "Failed to identify products from photo.");
  }

  const identifiedProducts: { brand: string; name: string }[] = data.products || [];

  // Log what Gemini Vision identified
  console.log("Gemini Vision identified products:", identifiedProducts);
  identifiedProducts.forEach((prod, index) => {
    console.log(`Product ${index + 1}: Brand: "${prod.brand}", Name: "${prod.name}"`);
  });

  if (identifiedProducts.length === 0) {
    throw new Error("There doesn't seem to be any product in this picture. Please try again.");
  }

  // Match Products Against Supabase with timeout and fallbacks
  const matchedProducts: MatchedProduct[] = [];

  for (const prod of identifiedProducts) {
    const brand = (prod.brand || "").trim();
    const name = (prod.name || "").trim();
    const searchString = `${brand} ${name}`.trim();
    if (!searchString) continue;

    let match: any = null;

    // 1. Try textSearch with timeout
    try {
      const formattedQuery = searchString
        .split(/\s+/)
        .filter(w => w.length > 0)
        .map(w => `${w}:*`)
        .join(' & ');

      const queryPromise = supabase
        .from("products")
        .select("id, brand, name, type, photo_url")
        .textSearch("fts_search", formattedQuery, { config: "english" })
        .limit(1);

      const dbRes = await Promise.race([
        queryPromise,
        new Promise<any>((_, reject) => setTimeout(() => reject(new Error("Supabase query timeout")), 4000))
      ]);

      if (dbRes && dbRes.data && dbRes.data.length > 0) {
        match = dbRes.data[0];
      }
    } catch (e) {
      console.warn("Text search timeout or error:", e);
    }

    // 2. If no match via textSearch, try ILIKE name/brand search with keyword verification
    if (!match && name) {
      try {
        const keywords = name.split(/\s+/).filter(w => w.length > 2);
        const keywordQuery = keywords.length > 0 ? keywords[0] : name;

        const nameQuery = supabase
          .from("products")
          .select("id, brand, name, type, photo_url")
          .ilike("brand", `%${brand}%`)
          .ilike("name", `%${keywordQuery}%`)
          .limit(5);

        const nameRes = await Promise.race([
          nameQuery,
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error("Supabase query timeout")), 4000))
        ]);

        if (nameRes && nameRes.data && nameRes.data.length > 0) {
          match = nameRes.data[0];
        }
      } catch (e) {
        console.warn("Name ILIKE fallback timeout or error:", e);
      }
    }

    // Verify match validity (ensure brand or name shares words, avoid picking completely unrelated products)
    if (match) {
      const matchNameLower = (match.name || "").toLowerCase();
      const identifiedNameLower = name.toLowerCase();
      const identifiedWords = identifiedNameLower.split(/\s+/).filter(w => w.length > 2);
      const hasOverlap = identifiedWords.length === 0 || identifiedWords.some(w => matchNameLower.includes(w));
      
      if (!hasOverlap) {
        match = null;
      }
    }

    // 3. If a valid match was found in the database, use it. Otherwise, use Gemini's identified product directly!
    if (match) {
      matchedProducts.push({
        id: match.id,
        brand: match.brand,
        name: match.name,
        type: match.type || "Treatment",
        photo_url: match.photo_url || undefined,
      });
    } else {
      matchedProducts.push({
        id: `scanned-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        brand: brand || "Unknown Brand",
        name: name || "Scanned Product",
        type: name.toLowerCase().includes('shampoo') ? 'Cleanser' : (name.toLowerCase().includes('cream') || name.toLowerCase().includes('moisturizer') ? 'Moisturiser' : 'Treatment'),
        photo_url: undefined,
      });
    }
  }

  return matchedProducts;
}

interface ProductConfirmationModalProps {
  isOpen: boolean;
  products: MatchedProduct[];
  onConfirm: (confirmed: MatchedProduct[]) => void;
  onCancel: () => void;
  user?: any;
  onLogin?: (confirmed: MatchedProduct[]) => void;
}

export const ProductConfirmationModal: React.FC<ProductConfirmationModalProps> = ({
  isOpen,
  products,
  onConfirm,
  onCancel,
  user,
  onLogin,
}) => {
  const [items, setItems] = useState<{ product: MatchedProduct; selected: boolean }[]>([]);

  useEffect(() => {
    if (isOpen) {
      setItems(products.map((p) => ({ product: p, selected: true })));
    }
  }, [isOpen, products]);

  const handleToggle = (index: number) => {
    setItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, selected: !item.selected } : item))
    );
  };

  const handleRemove = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleConfirm = () => {
    const confirmed = items.filter((item) => item.selected).map((item) => item.product);
    onConfirm(confirmed);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        id="photo-search-overlay" 
        className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-6"
      >
        <motion.div
          id="photo-search-modal-container"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white p-6 rounded-3xl w-full max-w-lg space-y-6 max-h-[90vh] overflow-y-auto"
        >
          {items.length > 0 && (
            <div className="flex flex-col gap-3 pb-4" id="modal-header">
              {!user ? (
                <>
                  <p className="text-sm md:text-base font-bold text-center text-black">
                    Take skin quiz or log in to find out if these products fit your skin
                  </p>
                  <button
                    id="confirm-products-btn"
                    onClick={handleConfirm}
                    className="w-full bg-black text-white py-3 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-black/80 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                  >
                    Take skin quiz
                  </button>
                  <div className="text-center pt-1">
                    <span
                      onClick={() => {
                        const confirmed = items.filter((item) => item.selected).map((item) => item.product);
                        if (onLogin) onLogin(confirmed);
                      }}
                      className="text-xs font-bold text-black underline hover:text-venus-accent cursor-pointer"
                    >
                      Log in
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <button
                    id="confirm-products-btn"
                    onClick={handleConfirm}
                    className="w-full bg-black text-white py-3 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-black/80 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                  >
                    Confirm & Add to Tracker
                  </button>
                  <p className="text-xs text-center text-black italic">
                    Confirm the matched products to add them to your routine tracker.
                  </p>
                </>
              )}
            </div>
          )}

          <div className="space-y-4" id="matched-products-list">
            {items.length === 0 ? (
              <p id="no-products-message" className="text-sm font-bold text-black/50 text-center py-6">
                Product not found
              </p>
            ) : (
              items.map((item, idx) => (
                <ProductResultRow key={`${item.product.id}-${idx}`} product={item.product} user={user} />
              ))
            )}
          </div>

          <div className="text-center pt-2">
            <span
              onClick={onCancel}
              className="text-xs text-black/60 hover:text-black cursor-pointer underline"
            >
              Close
            </span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
