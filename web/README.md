# Web (Next.js — BlueBeaver)

Frontend do monorepo, em [Next.js](https://nextjs.org/). O README principal está na [**raiz do repositório**](../README.md) (OHIF integrado, variáveis, Docker, Railway).

## Desenvolvimento local

Na pasta `web/`:

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no navegador. O OHIF empacotado em `public/ohif` só existe após build da imagem `web` ou fluxo equivalente — ver README na raiz.

## Fontes / OHIF

O build de produção gera ou injeta tema BlueBeaver, `app-config.js` e fontes conforme scripts em `web/scripts/` (detalhes no README da raiz).

## Mais sobre Next.js

- [Documentação Next.js](https://nextjs.org/docs)
- [Tutorial Learn Next.js](https://nextjs.org/learn)
