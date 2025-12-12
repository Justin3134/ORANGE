import { Request, Response } from 'express';

/**
 * Health check endpoint to verify the API is running.
 */
export const getHealth = (req: Request, res: Response) => {
  res.json({ status: 'ok' });
};
