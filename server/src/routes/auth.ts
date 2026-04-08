import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { verifyPCIToken } from '../pci/client';
import {
  findOrCreateSSOUser,
  findUserByEmail,
  createSession,
  invalidateSession,
  findUserById,
} from '../db/auth';

const router = Router();

// ── SSO Login (PCI users) ─────────────────────────────────
router.post('/sso', async (req: Request, res: Response) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ success: false, error: 'Token required' });

  try {
    const { data } = await verifyPCIToken(token);
    if (!data.valid) return res.status(401).json({ success: false, error: 'Invalid or expired token' });

    const user = await findOrCreateSSOUser({
      pci_id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      role: data.user.role || 'member',
      avatar_url: data.user.avatar,
      user_type: 'sso',
    });

    const sessionToken = jwt.sign(
      { userId: user.id, type: 'sso' },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    await createSession(user.id, sessionToken);

    return res.json({
      success: true,
      data: { token: sessionToken, user: sanitizeUser(user) },
    });
  } catch (err) {
    console.error('SSO error:', err);
    return res.status(500).json({ success: false, error: 'Authentication failed' });
  }
});

// ── Standalone Login (external users) ────────────────────
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ success: false, error: 'Email and password required' });

  try {
    const user = await findUserByEmail(email);
    if (!user || user.user_type !== 'standalone')
      return res.status(401).json({ success: false, error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ success: false, error: 'Invalid credentials' });

    const sessionToken = jwt.sign(
      { userId: user.id, type: 'standalone' },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    await createSession(user.id, sessionToken);

    // Update last seen
    return res.json({
      success: true,
      data: { token: sessionToken, user: sanitizeUser(user) },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// ── Get current user ──────────────────────────────────────
router.get('/me', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer '))
    return res.status(401).json({ success: false, error: 'Unauthorized' });

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
    const user = await findUserById(payload.userId);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    return res.json({ success: true, data: sanitizeUser(user) });
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
});

// ── Refresh token ─────────────────────────────────────────
router.post('/refresh', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer '))
    return res.status(401).json({ success: false, error: 'Unauthorized' });

  const oldToken = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(oldToken, process.env.JWT_SECRET!) as { userId: number; type: string };
    await invalidateSession(oldToken);

    const newToken = jwt.sign(
      { userId: payload.userId, type: payload.type },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    await createSession(payload.userId, newToken);
    return res.json({ success: true, data: { token: newToken } });
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
});

// ── Logout ────────────────────────────────────────────────
router.post('/logout', async (req: Request, res: Response) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) await invalidateSession(token);
  return res.json({ success: true });
});

// ── Reset password (external users) ──────────────────────
router.post('/reset-password', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, error: 'Email required' });

  try {
    const user = await findUserByEmail(email);
    // Always return success — don't reveal if email exists
    if (user && user.user_type === 'standalone') {
      // TODO: send reset email via SMTP (HUB-2 follow-up)
      console.log(`Password reset requested for: ${email}`);
    }
    return res.json({ success: true, data: { message: 'If this email exists, a reset link has been sent.' } });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to process request' });
  }
});

// ── Helpers ───────────────────────────────────────────────
function sanitizeUser(user: any) {
  const { password_hash, ...safe } = user;
  return safe;
}

export default router;
