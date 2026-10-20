import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ProductCardProvider } from './context/ProductCardContext';
import { ErrorProvider } from './context/ErrorContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorProvider>
      <ProductCardProvider>
        <App />
      </ProductCardProvider>
    </ErrorProvider>
  </StrictMode>,
);
