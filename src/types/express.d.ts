declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      traceId?: string;
      user?: { playerId: string };
    }
  }
}

export {};
