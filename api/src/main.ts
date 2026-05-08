import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

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
    }
    process.exit(1);
  }
}

async function bootstrap() {
  assertRequiredEnv();
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'healthz', method: RequestMethod.GET },
    ],
  });
  const origin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
  app.enableCors({
    origin: origin.split(',').map((o) => o.trim()),
    credentials: true,
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
  console.log(`[bootstrap] API a ouvir em http://${host}:${port} (health: /health)`);
}

bootstrap().catch((err) => {
  console.error('[bootstrap] Falha ao iniciar — veja DATABASE_URL, JWT_SECRET e Deploy Logs.');
  console.error(err);
  process.exit(1);
});
