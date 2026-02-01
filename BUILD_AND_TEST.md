# Build + Test Guide (HQ Builder + Card Builder)

This repo now hosts two apps that share a single SQLite database:
- **Quest Builder (Flask)** at `/`
- **Card Builder (Next.js static export)** at `/cards`

The Card Builder is built into `card-builder/out` and served by Flask.

---

## 1) Prerequisites

- **Python 3.10–3.12** (do not use 3.14 yet; some deps fail to build)
- **Node.js 18+** (npm comes with Node)

On macOS you can install Node with:
```
brew install node
```

---

## 2) Install Python dependencies

From the repo root:
```
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

---

## 3) Install Card Builder dependencies

From the repo root:
```
cd card-builder
npm install
```

---

## 4) Build the Card Builder (required)

From the repo root:
```
cd card-builder
npm run build
```

This creates:
```
card-builder/out
```

Flask serves this folder at `/cards`. If it is missing, you will see a “Card builder not built” message.

---

## 5) Run the combined app

From the repo root (ensure your venv is active):
```
export FLASK_APP=app.py
export FLASK_ENV=development
flask run
```

Then open:
```
http://127.0.0.1:5000
```

Register a user, sign in, and use the **Card Builder** link in the top navigation.

---

## 6) Data storage

Both apps now store data in the same SQLite file:
```
db/hqbuilder.db
```

This includes:
- users + maps (quest builder)
- cards + assets + collections (card builder)

---

## 7) Optional dev workflows

### Quest Builder only
If you only want to run the Flask app (without the card builder UI), you can skip the card builder build, but `/cards` will not work.

### Card Builder standalone (dev server)
You can still run the card builder by itself:
```
cd card-builder
npm run dev
```
Then open:
```
http://127.0.0.1:3000
```

Note: standalone mode still expects the Flask API for storage. For full functionality, keep Flask running on port 5000.
If you want the dev server to talk to Flask, run:
```
cd card-builder
NEXT_PUBLIC_API_BASE=http://127.0.0.1:5000/api npm run dev
```

---

## 8) Tests (optional)

There are no Python tests in this repo.

For the card builder:
```
cd card-builder
npm run test
```

Type checking:
```
cd card-builder
npm run typecheck
```

---

## 9) Troubleshooting

- **Card Builder shows a blank page**: re-run `npm run build` in `card-builder`.
- **Assets do not load**: confirm you are logged in to the Flask app and visiting `/cards` (same origin).
- **Session keeps logging out**: the Flask `SECRET_KEY` is generated at boot; restarting the server invalidates old sessions.
