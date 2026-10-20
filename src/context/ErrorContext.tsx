import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AppError {
  message: string;
  statusCode?: number | string;
  details?: string;
  technical?: string;
}

interface ErrorContextType {
  error: AppError | null;
  showError: (err: any, statusCode?: number | string, details?: string) => void;
  clearError: () => void;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

export const ErrorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [error, setError] = useState<AppError | null>(null);

  const showError = (err: any, statusCode?: number | string, details?: string) => {
    let message = 'An unexpected error occurred.';
    let code = statusCode || 500;
    let tech = details || '';

    if (typeof err === 'string' && err.trim()) {
      message = err;
    } else if (err instanceof Error) {
      message = err.message || 'An error occurred';
      tech = err.stack || details || '';
    } else if (err && typeof err === 'object') {
      message = err.message || err.error || (Object.keys(err).length > 0 ? JSON.stringify(err) : 'An unknown database or network error occurred.');
      code = err.status || err.code || statusCode || 500;
      tech = err.details || err.hint || details || '';
    } else if (err !== undefined && err !== null && String(err).trim() !== '') {
      message = String(err);
    }

    if (!message || message === '{}' || message === '[object Object]') {
      message = 'An unexpected system error occurred.';
    }

    // Ignore websocket, HMR, or connection refused errors so they never pop up an error modal
    const lowerMsg = message.toLowerCase();
    if (
      lowerMsg.includes('websocket') ||
      lowerMsg.includes('ws://') ||
      lowerMsg.includes('wss://') ||
      lowerMsg.includes('hmr') ||
      lowerMsg.includes('vite') ||
      lowerMsg.includes('connection refused') ||
      lowerMsg.includes('socket')
    ) {
      console.warn('[Ignored Dev/WebSocket Error]:', message);
      return;
    }

    console.error('[Global Error Caught]:', { message, code, tech, err });
    setError({ message, statusCode: code, details: tech });
  };

  const clearError = () => setError(null);

  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      const msg = (event.message || '').toLowerCase();
      if (
        msg.includes('websocket') ||
        msg.includes('ws://') ||
        msg.includes('wss://') ||
        msg.includes('hmr') ||
        msg.includes('vite') ||
        msg.includes('connection refused') ||
        msg.includes('socket')
      ) {
        return; // Ignore dev server websocket / HMR errors
      }
      if (event.error || event.message) {
        showError(event.error || event.message, 500, event.filename ? `at ${event.filename}:${event.lineno}` : undefined);
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reasonStr = String(event.reason || '').toLowerCase();
      if (
        reasonStr.includes('websocket') ||
        reasonStr.includes('ws://') ||
        reasonStr.includes('wss://') ||
        reasonStr.includes('hmr') ||
        reasonStr.includes('vite') ||
        reasonStr.includes('connection refused') ||
        reasonStr.includes('socket')
      ) {
        return; // Ignore dev server websocket / HMR errors
      }
      if (event.reason) {
        showError(event.reason, 500);
      }
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return (
    <ErrorContext.Provider value={{ error, showError, clearError }}>
      {children}
      {error && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-lg w-full border border-red-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center text-red-600 font-bold text-lg">
                  !
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 tracking-tight">System Error</h3>
                  {error.statusCode && (
                    <span className="text-xs font-bold text-red-500 uppercase tracking-widest">
                      Status / Code: {error.statusCode}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={clearError}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-red-50/80 border border-red-100 rounded-2xl p-4">
                <p className="text-sm font-bold text-red-900">{error.message}</p>
              </div>

              {error.details && (
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 max-h-40 overflow-y-auto">
                  <p className="text-xs font-mono text-gray-600 whitespace-pre-wrap">{error.details}</p>
                </div>
              )}

              <button
                onClick={clearError}
                className="w-full bg-black text-white py-3.5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-black/80 hover:scale-[1.01] active:scale-[0.99] transition-all shadow-lg"
              >
                Dismiss & Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </ErrorContext.Provider>
  );
};

export const useError = () => {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
};
