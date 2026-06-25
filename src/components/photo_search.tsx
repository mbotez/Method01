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
 * and queries Supabase using fts_search to find matching database records.
 */
export async function searchProductsFromPhoto(imageFile: File): Promise<MatchedProduct[]> {
  const base64 = await fileToBase64(imageFile);

  // Call server-side API to identify products
  const response = await fetch("/api/identify-products", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ image: base64 }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || "Failed to identify products from photo.");
  }

  const data = await response.json();
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
    // Step 2: No Product Handling
    throw new Error("There doesn't seem to be any product in this picture. Please try again.");
  }

  // Step 3: Match Products Against Supabase using fts_search
  const matchedProducts: MatchedProduct[] = [];

  for (const prod of identifiedProducts) {
    const searchString = `${prod.brand} ${prod.name}`.trim();
    if (!searchString) continue;

    // Search the products table using websearch
    const { data: dbData, error } = await supabase
      .from("products")
      .select("id, brand, name, type, photo_url")
      .textSearch("fts_search", searchString, {
        type: "websearch",
      });

    if (error) {
      console.error("Supabase full-text search error:", error);
      continue;
    }

    if (dbData && dbData.length > 0) {
      // Choose the highest-ranked match (the first record returned)
      const match = dbData[0];
      matchedProducts.push({
        id: match.id,
        brand: match.brand,
        name: match.name,
        type: match.type,
        photo_url: match.photo_url || undefined,
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
}

export const ProductConfirmationModal: React.FC<ProductConfirmationModalProps> = ({
  isOpen,
  products,
  onConfirm,
  onCancel,
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
            <div className="flex flex-col gap-2 pb-4" id="modal-header">
              <button
                id="confirm-products-btn"
                onClick={handleConfirm}
                className="w-full bg-black text-white py-3 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-black/80 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Take skin quiz
              </button>
              <p className="text-xs text-center text-black italic">
                Take our quiz to find out if these products fit your skin.
              </p>
            </div>
          )}

          <div className="space-y-4" id="matched-products-list">
            {items.length === 0 ? (
              <p id="no-products-message" className="text-sm font-bold text-black/50 text-center py-6">
                Product not found
              </p>
            ) : (
              items.map((item, idx) => (
<ProductResultRow key={`${item.product.id}-${idx}`} product={item.product} />
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
