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

    if (typeof err === 'string') {
      message = err;
    } else if (err instanceof Error) {
      message = err.message;
      tech = err.stack || details || '';
    } else if (err && typeof err === 'object') {
      message = err.message || err.error || JSON.stringify(err);
      code = err.status || err.code || statusCode || 500;
      tech = err.details || err.hint || details || '';
    }

    console.error('[Global Error Caught]:', { message, code, tech, err });
    setError({ message, statusCode: code, details: tech });
  };

  const clearError = () => setError(null);

  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      showError(event.error || event.message, 500, event.filename ? `at ${event.filename}:${event.lineno}` : undefined);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      showError(event.reason || 'Unhandled Promise Rejection', 500);
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
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
