# ADR-001: Express + Prisma en vez de NestJS

## Contexto

El brief original del proyecto pedía una API "básica pero segura" para gestionar el contenido eclesiástico de la IDD Preno (iglesias, pastores, líderes, congregantes, eventos, comunicados) y un panel administrativo simple. No había requisito de arquitectura hexagonal, inyección de dependencias avanzada, microservicios ni un framework con opiniones fuertes sobre la estructura del proyecto — el alcance es un monolito CRUD con autenticación.

## Decisión

Se construyó la API sobre **Express + TypeScript**, con **Prisma** como ORM, en vez de NestJS. La estructura interna se organiza por módulos de dominio (`routes` → `controller` → `service` → `schema` de validación con Zod), imitando la separación de responsabilidades que NestJS impondría por convención, pero sin el costo de aprendizaje ni el boilerplate (decoradores, módulos, providers) que NestJS requiere para un alcance de este tamaño.

## Consecuencias

- Menor curva de aprendizaje y menos código de infraestructura para un dominio que es, en esencia, CRUD sobre una decena de entidades relacionadas.
- La disciplina de capas (routes/controller/service) depende de la convención del equipo, no de la imposición del framework — se mitiga documentando la estructura (ver [Nivel 3 — Componentes del backend](../c4/nivel3-componentes-backend.md)).
- Mayor libertad para elegir librerías puntuales (`express-rate-limit`, `helmet`, `cookie-parser`) sin adaptarlas a la capa de abstracción de un framework más grande.
