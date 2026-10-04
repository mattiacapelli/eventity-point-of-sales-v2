# Eventity POS v2

Sistema **punto cassa modulare** per eventi, sagre e locali: funziona in locale sul
dispositivo di cassa (anche offline) e si collega a un pannello cloud per la gestione
del tenant. Fa parte della suite **Eventity**.

## Architettura

Monorepo **pnpm + Turborepo**:

```
apps/
  pos/             UI di cassa — React 18 + Vite, Zustand, TanStack Query, Dexie (offline)
  server/          server locale — Fastify (JWT, WebSocket, Swagger, rate limit)
  printer-agent/   agente di stampa (scontrini/comande) collegato all'event bus
modules/           moduli di dominio attivabili: sales, kitchen, tables, events,
                   inventory, payments, fiscal
packages/
  core/            logica condivisa (auth argon2, stampa, USB)
  db/              SQLite (better-sqlite3) + Drizzle ORM
  event-bus/       bus di eventi tra server, moduli e agenti
  sdk/             client per le app
  shared-types/    tipi condivisi
cloud/
  tenant-admin/    pannello amministrazione tenant (React + Vite)
  web-ui/          interfaccia web cloud
  web-ui-server/   backend della web UI
config/            app.config.ts e modules.json (moduli abilitati e priorità)
design/            mockup di brand e redesign
```

I moduli si accendono/spengono da `config/modules.json`.

## Funzionalità principali

- Vendita al banco con login operatore tramite PIN e wizard di setup del dispositivo
- Comande cucina, gestione tavoli, eventi, magazzino, pagamenti, modulo fiscale
- Stampa tramite printer agent dedicato
- Funzionamento offline con sincronizzazione

## Sviluppo

```bash
pnpm install
pnpm dev          # avvia tutte le app in parallelo (turbo)
pnpm build
pnpm typecheck
```

Deploy con Docker: `docker compose up` avvia `server` e `printer-agent`.
