import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import ErrorBoundary from './app/web/components/ErrorBoundary';
import { startHlsVideoRuntime } from './utils/hlsVideoRuntime';

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

// Start once at the application root so web Reels that still expose the original MP4
// can transparently switch to the server-generated adaptive HLS master when available.
try {
  startHlsVideoRuntime();
} catch (err) {
  console.warn('HLS runtime initialization note:', err);
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
