import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import ErrorBoundary from './components/ErrorBoundary';

// Initialize Native Mobile Device adjustments safely
try {
  if (typeof window !== 'undefined' && typeof Capacitor !== 'undefined' && Capacitor?.isNativePlatform && Capacitor.isNativePlatform()) {
    StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
    StatusBar.setBackgroundColor({ color: '#000000' }).catch(() => {});
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  }
} catch (err) {
  console.warn('Native status bar initialization note:', err);
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}


