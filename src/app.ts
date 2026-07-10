import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { logger } from './utils/logger';
import { authRouter } from './modules/auth/auth.routes';
import { distritosRouter } from './modules/distritos/distritos.routes';
import { iglesiasRouter } from './modules/iglesias/iglesias.routes';
import { pastoresRouter } from './modules/pastores/pastores.routes';
import { lideresRouter } from './modules/lideres/lideres.routes';
import { congregantesRouter } from './modules/congregantes/congregantes.routes';
import { ministeriosRouter } from './modules/ministerios/ministerios.routes';
import { eventosRouter } from './modules/eventos/eventos.routes';
import { comunicadosRouter } from './modules/comunicados/comunicados.routes';
import { usuariosRouter } from './modules/usuarios/usuarios.routes';
import { cargosRouter } from './modules/cargos/cargos.routes';
import { catalogosRouter } from './modules/catalogos/catalogos.routes';
import { notFoundHandler, errorHandler } from './middlewares/error.middleware';

export const app = express();

app.use(helmet());
app.use(compression());
app.use(pinoHttp({ logger }));
app.use(
  cors({
    origin: 'http://localhost:4200',
    credentials: true,
  }),
);
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());

app.use('/api/auth', authRouter);
app.use('/api/distritos', distritosRouter);
app.use('/api/iglesias', iglesiasRouter);
app.use('/api/pastores', pastoresRouter);
app.use('/api/lideres', lideresRouter);
app.use('/api/congregantes', congregantesRouter);
app.use('/api/ministerios', ministeriosRouter);
app.use('/api/eventos', eventosRouter);
app.use('/api/comunicados', comunicadosRouter);
app.use('/api/usuarios', usuariosRouter);
app.use('/api/cargos', cargosRouter);
app.use('/api', catalogosRouter);

app.use(notFoundHandler);
app.use(errorHandler);
