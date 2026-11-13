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
import { reportesRouter } from './modules/reportes/reportes.routes';
import { notFoundHandler, errorHandler } from './middlewares/error.middleware';
import { env } from './config/env';
import { spikeRouter } from './spike/realtime.spike';

export const app = express();

app.use(helmet());
app.use(compression());
app.use(pinoHttp({ logger }));
app.use(
  cors({
    origin: 'http://localhost:4200',
    credentials: true,
    // Sin exponerlo, el navegador oculta este encabezado al JS en peticiones entre orígenes y las
    // descargas de reportes se guardarían con el nombre de respaldo en vez del que arma el
    // backend (que incluye la fecha, para no pisar descargas de meses distintos).
    exposedHeaders: ['Content-Disposition'],
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
app.use('/api/reportes', reportesRouter);
// Spike de tiempo real (ADR-028): apagado salvo que SPIKE_TOKEN esté definido. Va antes de
// catalogosRouter, que está montado en '/api' y exige sesión a todo lo que pase por él.
if (env.SPIKE_TOKEN) {
  app.use('/api/spike', spikeRouter(env.SPIKE_TOKEN));
}
app.use('/api', catalogosRouter);

app.use(notFoundHandler);
app.use(errorHandler);
