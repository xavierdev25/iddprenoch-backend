import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';
import { loginRateLimiter } from '../../middlewares/rateLimiter';
import * as authController from './auth.controller';

export const authRouter = Router();

authRouter.post('/login', loginRateLimiter, authController.login);
authRouter.post('/logout', authController.logout);
authRouter.get('/me', requireAuth, authController.me);
