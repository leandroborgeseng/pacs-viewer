# API (NestJS — BlueBeaver)

Backend do monorepo: NestJS, Prisma, PostgreSQL, proxy DICOMweb, JWT/RBAC.

O guia operacional (**variáveis, Docker, Orthanc, Railway**) está no [**README da raiz**](../README.md).

## Desenvolvimento local

Na pasta `api/`:

```bash
npm install
cp .env.example .env   # ajuste DATABASE_URL e demais variáveis
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```

Documentação oficial do NestJS: [docs.nestjs.com](https://docs.nestjs.com).
