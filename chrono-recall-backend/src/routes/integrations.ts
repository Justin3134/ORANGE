import { Request, Response } from 'express';

/**
 * List available integrations with their connection status.
 * In production, this would check actual OAuth connections.
 */
export const getIntegrations = (req: Request, res: Response) => {
  const integrations = [
    { id: 'gmail', name: 'Gmail', connected: false },
    { id: 'instagram', name: 'Instagram', connected: false },
    { id: 'facebook', name: 'Facebook', connected: false },
    { id: 'slack', name: 'Slack', connected: false },
    { id: 'discord', name: 'Discord', connected: false }
  ];

  res.json(integrations);
};
