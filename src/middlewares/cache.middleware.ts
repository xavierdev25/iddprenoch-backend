import { NextFunction, Request, Response } from 'express';

// These list/detail GETs are shared by the public site AND the admin panel, so a plain
// max-age would make the admin see stale data right after a create/edit/delete. `no-cache`
// still lets the browser cache the body, but forces revalidation on every request; Express
// sets an ETag on every response by default and answers matching If-None-Match with a bodyless
// 304, so unchanged data is skipped almost for free while writes are reflected immediately.
export function revalidateCache(_req: Request, res: Response, next: NextFunction) {
  res.set('Cache-Control', 'no-cache');
  next();
}
