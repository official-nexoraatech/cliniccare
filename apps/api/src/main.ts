import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import express, { type Request, type Response } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  if (
    process.env.NODE_ENV === 'production' &&
    (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-me-in-production')
  ) {
    throw new Error(
      'JWT_SECRET must be set to a real secret in production — refusing to start with the insecure default.',
    );
  }

  // In production, serve the built web app from the same process/port as the API — one
  // deployment, one URL, no cross-origin setup needed. This must be registered BEFORE
  // Nest's own controller routes exist (they're only wired up during init()/listen()),
  // so for anything under /api or /files it calls next() to fall through to Nest's real
  // routing (and Nest's own 404 handling) once that's live — it must never answer those
  // paths itself. Guarded by existsSync so local `nest start` without a prior `vite
  // build` doesn't crash.
  const webDistPath = join(__dirname, '../../web/dist');
  if (existsSync(webDistPath)) {
    app.use(express.static(webDistPath));
    app.use((req: Request, res: Response, next: () => void) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/files')) {
        next();
        return;
      }
      res.sendFile(join(webDistPath, 'index.html'));
    });
  }

  // FRONTEND_URL supports one or more comma-separated origins (e.g. a Vercel production
  // domain plus its preview-deployment domains) for when the web app is hosted
  // separately from the API — Render (api) + Vercel (web) are on different origins,
  // unlike the same-origin single-deployment setup this app also supports.
  const configuredOrigins = (process.env.FRONTEND_URL ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    // Vercel gives every deployment several URLs (production alias, git-branch
    // preview, unique-per-deploy) — allow any *.vercel.app origin by pattern rather
    // than chasing down each specific variant via FRONTEND_URL. This is a demo app
    // gated by real login credentials, not something CORS alone is protecting.
    origin: [/^http:\/\/localhost:\d+$/, 'file://', /\.vercel\.app$/, ...configuredOrigins],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.useStaticAssets(join(process.cwd(), 'files'), { prefix: '/files' });
  app.setGlobalPrefix('api');

  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`ClinicCare API listening on http://localhost:${port}/api`);
}

bootstrap();
