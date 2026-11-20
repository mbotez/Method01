import React, { createContext, useContext, useState, ReactNode } from 'react';

type ProductCardContextType = {
  openProductCard: (productId: string, trackerItem?: any, initialFlag?: string) => void;
  openComparison: (productId1: string, productId2: string | string[]) => void;
  openComparisonPicker: (productId: string, trackerItem?: any) => void;
  openComparisonView: (productIds: string[]) => void;
  addToComparison: (productId: string) => void;
  removeFromComparison: (productId: string) => void;
  updateComparisonProduct: (index: number, newProductId: string) => void;
  closeProductCard: () => void;
  closeComparison: () => void;
  productId: string | null;
  compareProductIds: string[];
  compareProductId: string | null;
  trackerItem: any | null;
  initialFlag?: string | null;
  isOpen: boolean;
  comparisonStep: 'card' | 'picker' | 'view';
  setComparisonStep: (step: 'card' | 'picker' | 'view') => void;
};

const ProductCardContext = createContext<ProductCardContextType | undefined>(undefined);

export const ProductCardProvider = ({ children }: { children: ReactNode }) => {
  const [productId, setProductId] = useState<string | null>(null);
  const [compareProductIds, setCompareProductIds] = useState<string[]>([]);
  const [trackerItem, setTrackerItem] = useState<any | null>(null);
  const [initialFlag, setInitialFlag] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [comparisonStep, setComparisonStep] = useState<'card' | 'picker' | 'view'>('card');

  const openProductCard = (id: string, item?: any, flag?: string) => {
    setProductId(id);
    setCompareProductIds([]);
    setTrackerItem(item || null);
    setInitialFlag(flag || null);
    setComparisonStep('card');
    setIsOpen(true);
  };

  const openComparisonPicker = (id: string, item?: any) => {
    setProductId(id);
    setCompareProductIds([]);
    setTrackerItem(item || null);
    setInitialFlag(null);
    setComparisonStep('picker');
    setIsOpen(true);
  };

  const openComparisonView = (ids: string[]) => {
    if (ids.length === 0) return;
    setProductId(ids[0]);
    setCompareProductIds(ids.slice(1));
    setTrackerItem(null);
    setInitialFlag(null);
    setComparisonStep('view');
    setIsOpen(true);
  };

  const openComparison = (id1: string, id2OrIds: string | string[]) => {
    setProductId(id1);
    const ids = Array.isArray(id2OrIds) ? id2OrIds : [id2OrIds];
    const filtered = ids.filter(id => String(id) !== String(id1)).slice(0, 4);
    setCompareProductIds(filtered);
    setTrackerItem(null);
    setInitialFlag(null);
    setComparisonStep('view');
    setIsOpen(true);
  };

  const addToComparison = (newId: string) => {
    if (!productId) {
      setProductId(newId);
      return;
    }
    const currentAll = [productId, ...compareProductIds];
    if (currentAll.map(String).includes(String(newId))) return;
    if (currentAll.length >= 5) return;
    setCompareProductIds(prev => [...prev, String(newId)]);
    setIsOpen(true);
  };

  const removeFromComparison = (idToRemove: string) => {
    if (!productId) return;
    if (String(idToRemove) === String(productId)) {
      if (compareProductIds.length > 0) {
        setProductId(compareProductIds[0]);
        setCompareProductIds(prev => prev.slice(1));
      } else {
        closeProductCard();
      }
    } else {
      setCompareProductIds(prev => prev.filter(id => String(id) !== String(idToRemove)));
    }
  };

  const updateComparisonProduct = (index: number, newId: string) => {
    if (index === 0) {
      setProductId(newId);
    } else {
      const compIndex = index - 1;
      setCompareProductIds(prev => {
        const next = [...prev];
        next[compIndex] = newId;
        return next;
      });
    }
  };

  const closeComparison = () => {
    setCompareProductIds([]);
  };

  const closeProductCard = () => {
    setProductId(null);
    setCompareProductIds([]);
    setTrackerItem(null);
    setInitialFlag(null);
    setComparisonStep('card');
    setIsOpen(false);
  };

  return (
    <ProductCardContext.Provider
      value={{
        openProductCard,
        openComparison,
        openComparisonPicker,
        openComparisonView,
        addToComparison,
        removeFromComparison,
        updateComparisonProduct,
        closeProductCard,
        closeComparison,
        productId,
        compareProductIds,
        compareProductId: compareProductIds[0] || null,
        trackerItem,
        initialFlag,
        isOpen,
        comparisonStep,
        setComparisonStep
      }}
    >
      {children}
    </ProductCardContext.Provider>
  );
};

export const useProductCard = () => {
  const context = useContext(ProductCardContext);
  if (!context) {
    throw new Error('useProductCard must be used within a ProductCardProvider');
  }
  return context;
};
