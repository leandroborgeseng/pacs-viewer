import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import express from 'express';
import { AppModule } from './app.module';
import {
  IntegrationService,
  splitWebOrigins,
} from './integration/integration.service';

function assertRequiredEnv() {
  const missing: string[] = [];
  for (const key of ['DATABASE_URL', 'JWT_SECRET'] as const) {
    const v = process.env[key];
    if (v === undefined || String(v).trim() === '') {
      missing.push(key);
    }
  }
  if (missing.length > 0) {
    console.error(
      `[bootstrap] Variáveis em falta: ${missing.join(', ')}. O processo termina sem iniciar o servidor.`,
    );
    if (missing.includes('JWT_SECRET')) {
      console.error(
        '[bootstrap] Railway → serviço da API → Variables → New Variable → nome JWT_SECRET, valor: string aleatória longa (ex.: openssl rand -hex 32).',
      );
      const jwtLike = Object.keys(process.env).filter(
        (k) => k !== 'JWT_SECRET' && /jwt/i.test(k),
      );
      if (jwtLike.length > 0) {
        console.error(
          `[bootstrap] Atenção: existem outras variáveis com "jwt" no nome (${jwtLike.join(', ')}). O Nest espera o nome exato JWT_SECRET (maiúsculas).`,
        );
      }
    }
    process.exit(1);
  }
}

async function bootstrap() {
  assertRequiredEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use(express.json({ limit: '10mb' }));
  expressApp.use(
    express.urlencoded({ extended: true, limit: '2mb' }),
  );
  expressApp.get('/', (_req, res) => {
    res.status(200).json({
      service: 'pacs-viewer-api',
      health: '/health',
      healthz: '/healthz',
      api: '/api',
      hint: 'O portal web (Next.js) é outro serviço; isto é só a API REST.',
    });
  });
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'healthz', method: RequestMethod.GET },
    ],
  });

  const allowRailwayPublic =
    process.env.CORS_ALLOW_RAILWAY_PUBLIC !== '0' &&
    process.env.NODE_ENV === 'production';

  app.enableCors({
    origin: (
      requestOrigin: string | undefined,
      callback: (err: Error | null, allow?: boolean | string) => void,
    ) => {
      try {
        const svc = app.get(IntegrationService);
        if (!requestOrigin?.trim()) {
          callback(null, true);
          return;
        }
        const normalized = requestOrigin.replace(/\/+$/, '');
        const ok = svc.isBrowserOriginAllowed(normalized, {
          nodeEnv: process.env.NODE_ENV,
          allowRailwayPublic,
        });
        if (!ok) {
          console.warn(
            JSON.stringify({
              event: 'cors.denied',
              origin: normalized,
              nodeEnv: process.env.NODE_ENV ?? null,
              allowRailwayPublic,
              corsAllowedSnapshot: svc.corsAllowedOrigins.join(' | '),
            }),
          );
        }
        callback(null, ok);
      } catch {
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    maxAge: 86_400,
  });
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen(port, host);

  const integration = app.get(IntegrationService);
  const corsListed = integration.corsAllowedOrigins.join(' | ');
  console.log(
    `[bootstrap] CORS efectivo (WEB_ORIGIN + Admin → Integração): ${corsListed || '(lista vazia)'}`,
  );
  integration.logBootstrapSummary();

  const rEffective = integration.resolved;
  if (
    process.env.NODE_ENV === 'production' &&
    /localhost|127\.0\.0\.1/i.test(rEffective.dicomWebRoot)
  ) {
    console.warn(
      '[bootstrap] Aviso: URL DICOM/PACS efectivo aponta para localhost — o contentor cloud da API pode não alcançar esse host. Configure IP público/acessível em Administração → Integração (ou Orthanc nas variáveis do serviço).',
    );
  }

  const webEff =
    rEffective.webOriginPublic?.trim() ||
    splitWebOrigins(process.env.WEB_ORIGIN)[0] ||
    '';

  if (process.env.NODE_ENV === 'production' && !webEff) {
    console.warn(
      '[bootstrap] Aviso: URL pública do portal vazia (WEB_ORIGIN e Integração). O OHIF pode falhar ao resolver WADO/links DICOM.',
    );
  }

  const railwayPortHint = [
    '',
    '========================================',
    '  Railway — porta INTERNA a configurar',
    '========================================',
    `  process.env.PORT (bruto):  ${process.env.PORT ?? '<vazio — Nest usa 3000>'}`,
    `  Nest está a ouvir em:      ${host}:${port}`,
    '',
    '  No serviço da API → Networking / Target →',
    `  coloque este número:       ${port}`,
    '  (Docker EXPOSE só documenta; o proxy liga a esta porta.)',
    '========================================',
    '',
  ].join('\n');
  console.log(railwayPortHint);
  console.log(`[bootstrap] API a ouvir em http://${host}:${port} (health: /health)`);
}

bootstrap().catch((err) => {
  console.error('[bootstrap] Falha ao iniciar — veja DATABASE_URL, JWT_SECRET e Deploy Logs.');
  console.error(err);
  process.exit(1);
});
