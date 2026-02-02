# Build + Test Guide (Node + React)

The project now runs as a **single Next.js app** (Node + React):

- **Quest Builder**: `/`
- **Card Builder**: `/cards`
- **API**: `/api/*`

All data is stored in SQLite at:
```
db/hqbuilder.db
```

---

## 1) Prerequisites

- **Node.js 18+** (npm included)

---

## 2) Install dependencies

From the repo root:
```
cd card-builder
npm install
```

---

## 3) Run in development

```
cd card-builder
npm run dev
```

Then open:
```
http://127.0.0.1:3000
```

---

## 4) Production build + run

The build step requires `NEXT_PUBLIC_SITE_URL` (non‑localhost URL) to satisfy the existing env check.

```
cd card-builder
NEXT_PUBLIC_SITE_URL=https://example.com npm run build
npm run start
```

Then open:
```
http://127.0.0.1:3000
```

---

## 5) Data storage

All data is stored in:
```
db/hqbuilder.db
```

Tables are created automatically on first run.

---

## 6) Tests (optional)

```
cd card-builder
npm run typecheck
npm run test
```

---

## 7) Troubleshooting

- **Missing fonts or assets**: ensure `card-builder/public/static/` exists (it contains the shared map/quest assets).
- **Build fails on env check**: set `NEXT_PUBLIC_SITE_URL` to any non‑localhost URL, e.g. `https://example.com`.
- **DB not found**: ensure `db/hqbuilder.db` exists (it will be created on first run).
