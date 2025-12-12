import { Request, Response } from 'express';

/**
 * Development login endpoint.
 * In production, this would be replaced with proper OAuth authentication.
 */
export const devLogin = (req: Request, res: Response) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  // In a real app, you'd validate credentials and return a JWT
  res.json({ userId });
};
