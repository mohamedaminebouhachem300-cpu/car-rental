import React, { ErrorInfo } from 'react';

export default class ErrorBoundary extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    (this as any).state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  render() {
    const state = (this as any).state;
    const props = (this as any).props;

    if (state.hasError) {
      let errorMessage = 'An unexpected error occurred.';
      try {
        const parsedError = JSON.parse(state.error?.message || '{}');
        if (parsedError.error) {
          errorMessage = parsedError.error;
        }
      } catch (e) {
        errorMessage = state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-[#1A1A1A] text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-8">
            <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold tracking-tighter mb-4 uppercase">SYSTEM ERROR</h2>
          <p className="text-white/60 mb-8 max-w-md">
            {errorMessage}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-[#007BFF] hover:bg-blue-600 text-white font-semibold py-3 px-8 rounded-lg transition-all"
          >
            RELOAD APPLICATION
          </button>
        </div>
      );
    }

    return props.children;
  }
}
