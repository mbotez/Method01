import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ProductCardProvider } from './context/ProductCardContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProductCardProvider>
      <App />
    </ProductCardProvider>
  </StrictMode>,
);
