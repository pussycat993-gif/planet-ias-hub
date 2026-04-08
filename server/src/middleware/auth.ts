import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { isSessionValid } from '../db/auth';

export interface AuthRequest extends Request {
  userId: number;
  userType: string;
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify JWT signature and expiry
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: number;
      type: string;
    };

    // Verify session exists in DB (handles logout invalidation)
    const valid = await isSessionValid(token);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Session expired or logged out' });
    }

    (req as AuthRequest).userId = payload.userId;
    (req as AuthRequest).userType = payload.type;
    return next();
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}
