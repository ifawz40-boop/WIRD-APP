import appletConfig from '../firebase-applet-config.json';

export default function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  const host = String(req.headers?.host || '').split(':')[0];
  const authDomain = host === 'wird-app.vercel.app' ? 'wird-app.vercel.app' : appletConfig.authDomain;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.status(200).json({
    projectId: appletConfig.projectId,
    appId: appletConfig.appId,
    apiKey: appletConfig.apiKey,
    authDomain,
    storageBucket: appletConfig.storageBucket,
    messagingSenderId: appletConfig.messagingSenderId
  });
}
