import './utils/cryptoPolyfill.js';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from './providers/ThemeProvider.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { App } from './App.js';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
