import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase, recoverSupabaseSession } from '../lib/supabase';
import { ProductResultRow } from './ProductResultRow';
import { getApiEndpoint } from '../utils/auth';
import imageCompression from 'browser-image-compression';

export interface MatchedProduct {
  id: string;
  brand: string;
  name: string;
  type: string;
  photo_url?: string;
}

/**
 * Robust in-thread canvas compression fallback that avoids WebWorker stalls in
 * mobile browsers, WebViews, and Capacitor environments.
 */
async function compressWithCanvas(file: File, maxDim: number = 1000, quality: number = 0.8): Promise<string> {
  console.log('[PhotoAnalysis:compressWithCanvas] Starting in-thread canvas compression for:', file.name, 'Size:', file.size);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Canvas image compression timed out after 6 seconds.'));
    }, 6000);

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      clearTimeout(timeout);
      try {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          return reject(new Error('HTML Canvas 2D context is not available.'));
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        URL.revokeObjectURL(objectUrl);
        console.log('[PhotoAnalysis:compressWithCanvas] Canvas compression succeeded. Output chars:', dataUrl.length);
        resolve(dataUrl);
      } catch (err: any) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error(`Canvas compression rendering failed: ${err.message || err}`));
      }
    };

    img.onerror = (e) => {
      clearTimeout(timeout);
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Failed to decode image into canvas: ${e}`));
    };

    img.src = objectUrl;
  });
}

/**
 * Converts File to base64 Data URL with multi-stage fallback and timeouts:
 * 1. Validates file and image format
 * 2. Tries browser-image-compression (with useWebWorker: false to prevent worker deadlocks)
 * 3. Falls back to Canvas downsampling if worker/library fails or times out
 * 4. Falls back to FileReader as last resort
 */
async function fileToBase64(file: File): Promise<string> {
  if (!file) {
    throw new Error('No image file selected.');
  }

  console.log(`[PhotoAnalysis:fileToBase64] Processing file: "${file.name}", type: "${file.type}", size: ${file.size} bytes`);

  // Basic image format verification
  const isImageMime = file.type?.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif|bmp)$/i.test(file.name || '');
  if (!isImageMime && file.type) {
    throw new Error('The selected file is not a supported image format. Please select a JPG, PNG, or WebP photo.');
  }

  // Stage 1: Try browser-image-compression without web worker (in-thread to prevent worker lockups)
  try {
    console.log('[PhotoAnalysis:fileToBase64] Stage 1: Attempting browser-image-compression...');
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1000,
      useWebWorker: false, // In-thread to avoid web worker hangs in Capacitor / mobile webviews
      fileType: 'image/jpeg',
      initialQuality: 0.8,
    };

    const compressionPromise = imageCompression(file, options);
    const timeoutPromise = new Promise<File>((_, reject) =>
      setTimeout(() => reject(new Error('browser-image-compression timed out after 5s')), 5000)
    );

    const compressedFile = await Promise.race([compressionPromise, timeoutPromise]);
    console.log('[PhotoAnalysis:fileToBase64] Stage 1 succeeded. Compressed file size:', compressedFile.size);

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      const readerTimeout = setTimeout(() => reject(new Error('FileReader timed out reading compressed image')), 4000);
      reader.onload = () => {
        clearTimeout(readerTimeout);
        resolve(reader.result as string);
      };
      reader.onerror = (error) => {
        clearTimeout(readerTimeout);
        reject(new Error(`FileReader error: ${error}`));
      };
      reader.readAsDataURL(compressedFile);
    });
  } catch (stage1Err: any) {
    console.warn('[PhotoAnalysis:fileToBase64] Stage 1 failed or timed out:', stage1Err.message, 'Proceeding to Stage 2 (Canvas fallback)...');
  }

  // Stage 2: Canvas in-thread compression fallback
  try {
    console.log('[PhotoAnalysis:fileToBase64] Stage 2: Running compressWithCanvas...');
    const canvasDataUrl = await compressWithCanvas(file, 1000, 0.8);
    return canvasDataUrl;
  } catch (stage2Err: any) {
    console.warn('[PhotoAnalysis:fileToBase64] Stage 2 Canvas compression failed:', stage2Err.message, 'Proceeding to Stage 3 (Direct FileReader)...');
  }

  // Stage 3: Direct FileReader fallback
  try {
    console.log('[PhotoAnalysis:fileToBase64] Stage 3: Direct FileReader reading...');
    const rawDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      const readerTimeout = setTimeout(() => reject(new Error('Direct FileReader timed out after 5s')), 5000);
      reader.onload = () => {
        clearTimeout(readerTimeout);
        resolve(reader.result as string);
      };
      reader.onerror = (err) => {
        clearTimeout(readerTimeout);
        reject(new Error(`FileReader failed: ${err}`));
      };
      reader.readAsDataURL(file);
    });

    console.log('[PhotoAnalysis:fileToBase64] Stage 3 succeeded. Data URL length:', rawDataUrl.length);
    return rawDataUrl;
  } catch (stage3Err: any) {
    console.error('[PhotoAnalysis:fileToBase64] All image processing stages failed:', stage3Err);
    throw new Error(`Failed to process photo for analysis: ${stage3Err.message || 'Image encoding error'}`);
  }
}

/**
 * Sends a compressed product photo to the Gemini Vision API, identifies products, 
 * and queries Supabase using fts_search and fallbacks to find matching database records.
 * Completely removes silent fallbacks and mock data—errors and missing matches bubble up.
 */
export async function searchProductsFromPhoto(imageFile: File): Promise<MatchedProduct[]> {
  console.log('[PhotoAnalysis:searchProductsFromPhoto] Starting photo analysis for file:', imageFile.name);

  // 1. Process and compress image to base64 Data URL
  const base64 = await fileToBase64(imageFile);
  console.log('[PhotoAnalysis:searchProductsFromPhoto] Image prepared. Base64 payload length:', base64.length);

  // Check payload size limit (warn if larger than 3.5MB to prevent Vercel 413)
  if (base64.length > 3.5 * 1024 * 1024) {
    console.warn('[PhotoAnalysis:searchProductsFromPhoto] Payload is over 3.5MB, may exceed serverless limit. Re-compressing...');
    try {
      const downscaled = await compressWithCanvas(imageFile, 800, 0.65);
      console.log('[PhotoAnalysis:searchProductsFromPhoto] Downscaled to:', downscaled.length);
    } catch (e) {
      console.warn('[PhotoAnalysis:searchProductsFromPhoto] Could not downscale further, using primary base64');
    }
  }

  // 2. Call server-side API to identify products with a 22-second timeout
  const apiEndpoint = getApiEndpoint('/api/identify-products');
  console.log('[PhotoAnalysis:searchProductsFromPhoto] Calling API endpoint:', apiEndpoint);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.warn('[PhotoAnalysis:searchProductsFromPhoto] Aborting API call after 22 seconds timeout.');
    controller.abort();
  }, 22000);

  let response: Response;
  try {
    response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: base64 }),
      signal: controller.signal,
    });
    console.log('[PhotoAnalysis:searchProductsFromPhoto] API response received. Status:', response.status);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.error('[PhotoAnalysis:searchProductsFromPhoto] Product identification request timed out after 22 seconds.');
      throw new Error('Product identification request timed out after 22 seconds. Please try again with a clearer or closer photo.');
    }
    console.error('[PhotoAnalysis:searchProductsFromPhoto] Network failure during API call:', err);
    throw new Error(`Network failure during product identification: ${err.message || err}`);
  } finally {
    clearTimeout(timeoutId);
  }

  // Handle non-OK HTTP status
  if (!response.ok) {
    let errMessage = `Product identification API failed with status ${response.status}`;
    try {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const errData = await response.json();
        errMessage = errData.error || errMessage;
      } else {
        const text = await response.text();
        console.warn('[PhotoAnalysis:searchProductsFromPhoto] API returned non-JSON error body:', text.slice(0, 200));
        if (response.status === 413) {
          errMessage = 'Photo file is too large for the server. Please take a closer photo with fewer products.';
        } else if (response.status === 404) {
          errMessage = 'Product identification endpoint not found (404).';
        }
      }
    } catch {
      // Use fallback errMessage
    }
    console.error('[PhotoAnalysis:searchProductsFromPhoto] API error:', errMessage);
    throw new Error(errMessage);
  }

  // Parse JSON response safely
  let data: any;
  try {
    data = await response.json();
  } catch (jsonErr: any) {
    console.error('[PhotoAnalysis:searchProductsFromPhoto] Failed to parse JSON response:', jsonErr);
    throw new Error('Received invalid response from product identification service.');
  }

  if (!data.success) {
    console.error('[PhotoAnalysis:searchProductsFromPhoto] Identification unsuccessful:', data.error);
    throw new Error(data.error || 'Failed to identify products from photo.');
  }

  const identifiedProducts: { brand: string; name: string }[] = data.products || [];
  console.log(`[PhotoAnalysis:searchProductsFromPhoto] Identified ${identifiedProducts.length} product(s) from photo:`, identifiedProducts);

  if (identifiedProducts.length === 0) {
    throw new Error('No skincare or cosmetic products could be identified in this photo. Please ensure product labels are clearly visible and try again.');
  }

  // 3. Ensure Supabase auth session and network sockets are healthy before querying database
  // (Crucial because camera activity or photo picker backgrounds the app/tab!)
  try {
    console.log('[PhotoAnalysis:searchProductsFromPhoto] Refreshing Supabase session before DB queries...');
    await recoverSupabaseSession();
  } catch (sessErr) {
    console.warn('[PhotoAnalysis:searchProductsFromPhoto] Supabase session recovery check failed, proceeding with query:', sessErr);
  }

  // 4. Match identified products against Supabase
  const matchedProducts: MatchedProduct[] = [];

  for (const prod of identifiedProducts) {
    const rawBrand = (prod.brand || '').trim();
    const rawName = (prod.name || '').trim();
    const searchString = `${rawBrand} ${rawName}`.trim();
    if (!searchString) continue;

    console.log(`[PhotoAnalysis:searchProductsFromPhoto] Matching product "${searchString}" against Supabase...`);

    let match: any = null;

    // Sanitize searchString for PostgreSQL tsquery: strip operators & | ! : * ( ) ' " \ /
    const sanitizedSearch = searchString
      .replace(/[&|!:*()'"\\/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const terms = sanitizedSearch
      .split(/\s+/)
      .filter((w) => w.length > 1)
      .map((w) => `${w}:*`);

    if (terms.length > 0) {
      const formattedQuery = terms.join(' & ');
      try {
        console.log(`[PhotoAnalysis:searchProductsFromPhoto] Running textSearch with query: "${formattedQuery}"`);
        const queryPromise = supabase
          .from('products')
          .select('id, brand, name, type, photo_url')
          .textSearch('fts_search', formattedQuery, { config: 'english' })
          .limit(1);

        const timeoutPromise = new Promise<any>((_, reject) =>
          setTimeout(() => reject(new Error('Supabase FTS search query timeout (6s)')), 6000)
        );

        const dbRes = await Promise.race([queryPromise, timeoutPromise]);

        if (dbRes.error) {
          console.warn('[PhotoAnalysis:searchProductsFromPhoto] FTS search returned error:', dbRes.error.message);
        } else if (dbRes.data && dbRes.data.length > 0) {
          match = dbRes.data[0];
          console.log('[PhotoAnalysis:searchProductsFromPhoto] FTS match found:', match.brand, '-', match.name);
        }
      } catch (ftsErr: any) {
        console.warn('[PhotoAnalysis:searchProductsFromPhoto] FTS search exception, falling back to ILIKE:', ftsErr.message);
      }
    }

    // Fallback: If no match via textSearch, try ILIKE name/brand search
    if (!match && rawName) {
      try {
        const keywords = rawName.split(/\s+/).filter((w) => w.length > 2);
        const keywordQuery = keywords.length > 0 ? keywords[0] : rawName;

        console.log(`[PhotoAnalysis:searchProductsFromPhoto] Running ILIKE fallback for brand: "${rawBrand}", name: "${keywordQuery}"`);

        const nameQuery = supabase
          .from('products')
          .select('id, brand, name, type, photo_url')
          .ilike('brand', `%${rawBrand}%`)
          .ilike('name', `%${keywordQuery}%`)
          .limit(5);

        const nameTimeout = new Promise<any>((_, reject) =>
          setTimeout(() => reject(new Error('Supabase ILIKE search query timeout (6s)')), 6000)
        );

        const nameRes = await Promise.race([nameQuery, nameTimeout]);

        if (nameRes.error) {
          console.warn('[PhotoAnalysis:searchProductsFromPhoto] ILIKE search returned error:', nameRes.error.message);
        } else if (nameRes.data && nameRes.data.length > 0) {
          match = nameRes.data[0];
          console.log('[PhotoAnalysis:searchProductsFromPhoto] ILIKE match found:', match.brand, '-', match.name);
        }
      } catch (ilikeErr: any) {
        console.warn('[PhotoAnalysis:searchProductsFromPhoto] ILIKE search exception:', ilikeErr.message);
      }
    }

    if (!match) {
      console.warn(`[PhotoAnalysis:searchProductsFromPhoto] Product not found in database: "${rawBrand} - ${rawName}"`);
      throw new Error(`Product "${rawBrand} - ${rawName}" identified in photo was not found in the verified database. Please select or add it manually.`);
    }

    matchedProducts.push({
      id: match.id,
      brand: match.brand,
      name: match.name,
      type: match.type || 'Treatment',
      photo_url: match.photo_url || undefined,
    });
  }

  if (matchedProducts.length === 0) {
    console.error('[PhotoAnalysis:searchProductsFromPhoto] No matching products verified in database.');
    throw new Error('No matching products found in the database. Please try another photo or search manually.');
  }

  console.log('[PhotoAnalysis:searchProductsFromPhoto] Photo search complete. Returning matched products:', matchedProducts);
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
          className="bg-white p-6 rounded-3xl w-full max-w-lg space-y-6 max-h-[90vh] overflow-y-auto shadow-2xl"
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
