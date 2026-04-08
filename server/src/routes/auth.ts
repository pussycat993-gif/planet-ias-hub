import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { verifyPCIToken } from '../pci/client';
import { findOrCreateSSOUser, findUserByEmail, createSession, invalidateSession } from '../db/auth';

const router = Router();

// ── SSO Login (PCI users) ──────────────────────────────────────────
router.post('/sso', async (req: Request, res: Response) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Token required' });
  }

  try {
    // Verify token with PCI API
    const { data } = await verifyPCIToken(token);

    if (!data.valid) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Find or create user in IAS Hub DB
    const user = await findOrCreateSSOUser({
      pci_id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      role: data.user.role,
      avatar_url: data.user.avatar,
      user_type: 'sso',
    });

    // Issue IAS Hub session token (24h)
    const sessionToken = jwt.sign(
      { userId: user.id, type: 'sso' },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    await createSession(user.id, sessionToken);

    return res.json({ token: sessionToken, user });

  } catch (err) {
    console.error('SSO auth error:', err);
    return res.status(500).json({ error: 'Authentication failed' });
  }
});

// ── Standalone Login (external users) ─────────────────────────────
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const user = await findUserByEmail(email);

    if (!user || user.user_type !== 'standalone') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Issue session token (24h)
    const sessionToken = jwt.sign(
      { userId: user.id, type: 'standalone' },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    await createSession(user.id, sessionToken);

    return res.json({ token: sessionToken, user });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// ── Get current user ───────────────────────────────────────────────
router.get('/me', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
    // Return user from DB based on payload.userId
    return res.json({ userId: payload.userId });
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// ── Logout ─────────────────────────────────────────────────────────
router.post('/logout', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  if (token) {
    await invalidateSession(token);
  }

  return res.json({ success: true });
});

export default router;
