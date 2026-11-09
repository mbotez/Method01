import React, { createContext, useContext, useState, ReactNode } from 'react';

type ProductCardContextType = {
  openProductCard: (productId: string, trackerItem?: any, initialFlag?: string) => void;
  openComparison: (productId1: string, productId2: string) => void;
  closeProductCard: () => void;
  closeComparison: () => void;
  productId: string | null;
  compareProductId: string | null;
  trackerItem: any | null;
  initialFlag?: string | null;
  isOpen: boolean;
};

const ProductCardContext = createContext<ProductCardContextType | undefined>(undefined);

export const ProductCardProvider = ({ children }: { children: ReactNode }) => {
  const [productId, setProductId] = useState<string | null>(null);
  const [compareProductId, setCompareProductId] = useState<string | null>(null);
  const [trackerItem, setTrackerItem] = useState<any | null>(null);
  const [initialFlag, setInitialFlag] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const openProductCard = (id: string, item?: any, flag?: string) => {
    setProductId(id);
    setCompareProductId(null);
    setTrackerItem(item || null);
    setInitialFlag(flag || null);
    setIsOpen(true);
  };

  const openComparison = (id1: string, id2: string) => {
    setProductId(id1);
    setCompareProductId(id2);
    setTrackerItem(null);
    setInitialFlag(null);
    setIsOpen(true);
  };

  const closeComparison = () => {
    setCompareProductId(null);
  };

  const closeProductCard = () => {
    setProductId(null);
    setCompareProductId(null);
    setTrackerItem(null);
    setInitialFlag(null);
    setIsOpen(false);
  };

  return (
    <ProductCardContext.Provider
      value={{
        openProductCard,
        openComparison,
        closeProductCard,
        closeComparison,
        productId,
        compareProductId,
        trackerItem,
        initialFlag,
        isOpen
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

