import React, { createContext, useContext, useState, ReactNode } from 'react';

type ProductCardContextType = {
  openProductCard: (productId: string, trackerItem?: any) => void;
  closeProductCard: () => void;
  productId: string | null;
  trackerItem: any | null;
  isOpen: boolean;
};

const ProductCardContext = createContext<ProductCardContextType | undefined>(undefined);

export const ProductCardProvider = ({ children }: { children: ReactNode }) => {
  const [productId, setProductId] = useState<string | null>(null);
  const [trackerItem, setTrackerItem] = useState<any | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const openProductCard = (id: string, item?: any) => {
    setProductId(id);
    setTrackerItem(item || null);
    setIsOpen(true);
  };

  const closeProductCard = () => {
    setProductId(null);
    setTrackerItem(null);
    setIsOpen(false);
  };

  return (
    <ProductCardContext.Provider value={{ openProductCard, closeProductCard, productId, trackerItem, isOpen }}>
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
