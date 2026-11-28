import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { AuthGate } from './components/auth/AuthGate.tsx';
import './index.css';
import './wird-identity.css';
import {
  applyThemePreferencesToDocument,
  loadSavedAppearanceMode,
  loadThemePreferences,
} from './services/themePreferences';

applyThemePreferencesToDocument(
  loadThemePreferences(),
  loadSavedAppearanceMode(
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  )
);

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <AuthGate>
      <App />
    </AuthGate>
  </AuthProvider>
);

// Register Service Worker in production environment or browser preview
if ('serviceWorker' in navigator && (import.meta.env.PROD || process.env.NODE_ENV === 'production')) {
  const registerServiceWorker = () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('[WIRD PWA] Service Worker registered successfully with scope:', registration.scope);
        void registration.update().catch(() => undefined);

        // Check for updates
        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;

          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[WIRD PWA] New update available');
              // Dispatch event for in-app banner
              window.dispatchEvent(new CustomEvent('wird-pwa-update-available', {
                detail: { registration }
              }));
            }
          });
        });
      })
      .catch((error) => {
        console.warn('[WIRD PWA] Service Worker registration failed:', error);
      });
  };

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', registerServiceWorker, { once: true });
  } else {
    registerServiceWorker();
  }
}
