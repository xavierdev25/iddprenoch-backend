export interface AuthUser {
  id: number;
  nombre: string;
  rolId: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
