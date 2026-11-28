import fs from 'node:fs';

interface PublicFirebaseInitConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  storageBucket: string;
  messagingSenderId: string;
}

let cachedAppletConfig: Partial<PublicFirebaseInitConfig> | null = null;

function readPublicFirebaseConfig(): Partial<PublicFirebaseInitConfig> {
  if (cachedAppletConfig) return cachedAppletConfig;
  try {
    const raw = fs.readFileSync(new URL('../firebase-applet-config.json', import.meta.url), 'utf8');
    cachedAppletConfig = JSON.parse(raw) as Partial<PublicFirebaseInitConfig>;
    return cachedAppletConfig;
  } catch {
    return {};
  }
}

export default function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  const appletConfig = readPublicFirebaseConfig();
  const host = String(req.headers?.host || '').split(':')[0];
  const authDomain =
    host === 'wird-app.vercel.app'
      ? 'wird-app.vercel.app'
      : process.env.VITE_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain || 'wird-quran-app.firebaseapp.com';

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.status(200).json({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId || 'wird-quran-app',
    appId: process.env.VITE_FIREBASE_APP_ID || appletConfig.appId || '',
    apiKey: process.env.VITE_FIREBASE_API_KEY || appletConfig.apiKey || '',
    authDomain,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket || '',
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig.messagingSenderId || '',
  });
}
