import { NextFunction, Request, Response } from 'express';
import { config } from '../config';

const ADMIN_TOKEN_HEADER = 'x-admin-token';

export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  if (!config.adminToken) {
    res.status(503).json({ error: 'Admin access is not configured' });
    return;
  }

  const headerToken = req.header(ADMIN_TOKEN_HEADER) ?? extractBearerToken(req.header('authorization'));
  if (!headerToken || headerToken !== config.adminToken) {
    res.status(401).json({ error: 'Invalid admin token' });
    return;
  }

  next();
}

function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token.trim();
}
