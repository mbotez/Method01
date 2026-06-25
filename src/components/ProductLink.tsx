import React from 'react';
import { useProductCard } from '../context/ProductCardContext';

export const ProductLink = ({ productId, productName, className }: { productId: string, productName: string, className?: string }) => {
  const { openProductCard } = useProductCard();

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openProductCard(productId);
      }}
      className={`text-blue-600 hover:underline cursor-pointer ${className || ''}`}
    >
      {productName}
    </button>
  );
};
