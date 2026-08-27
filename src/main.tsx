import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

// Initialize Native Mobile Device adjustments
if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
  try {
    StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
    StatusBar.setBackgroundColor({ color: '#000000' }).catch(() => {});
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  } catch (err) {
    console.warn('Native status bar initialization note:', err);
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

