// Firebase Admin — verifies the ID token the dashboard sends with each request.
// The dashboard logs in with Firebase Auth (client), gets an ID token, and sends
// it as `Authorization: Bearer <token>`. We verify it here and load the user's role.
import admin from 'firebase-admin';
import { supa } from './supa.js';

// The service account JSON is provided as one env var (stringified JSON).
const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
if (svc && !admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(svc)) });
} else if (!svc) {
  console.warn('⚠️  FIREBASE_SERVICE_ACCOUNT not set — dashboard auth will fail.');
}

// Express middleware: verify Firebase token, attach req.user = {uid,email,role,companyId}.
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'No token' });

    const decoded = await admin.auth().verifyIdToken(token);

    // Look up the app-level role/company for this Firebase user.
    // app_users.id IS the Firebase UID (see db/schema.sql).
    const { data: user } = await supa
      .from('app_users')
      .select('*')
      .eq('id', decoded.uid)
      .maybeSingle();

    if (!user || !user.company_id) {
      // Not yet provisioned by an owner (or bootstrap not run).
      return res.status(403).json({
        error: 'Account not provisioned. Ask the owner to add you.',
        uid: decoded.uid,
        email: decoded.email,
      });
    }

    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      role: user.role,
      companyId: user.company_id,
      name: user.name,
    };
    next();
  } catch (err) {
    console.error('Auth error:', err.message);
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Guard for owner-only actions (knowledge edits, team management, billing).
export function requireOwner(req, res, next) {
  if (req.user?.role !== 'owner') {
    return res.status(403).json({ error: 'Owner only' });
  }
  next();
}
