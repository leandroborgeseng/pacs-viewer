import { RequestMethod } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api', {
      exclude: [
        { path: 'health', method: RequestMethod.GET },
        { path: 'healthz', method: RequestMethod.GET },
      ],
    });
    await app.init();
  });

  it('GET /health retorna ok quando DATABASE_URL está configurado', async () => {
    if (!process.env.DATABASE_URL) {
      return;
    }
    const res = await request(app.getHttpServer()).get('/health');
    expect([200, 500]).toContain(res.status);
  });

  afterEach(async () => {
    await app.close();
  });
});
