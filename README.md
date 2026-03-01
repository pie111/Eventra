# Eventra

Eventra is a stateful, event-driven autonomous agent system that transforms natural language instructions into persistent workflows, continuously monitors conditions, and executes actions using tool orchestration.

## Architecture

```
src/
├── index.ts              # Entry point — starts the API server
├── types/                # Shared TypeScript types (task, tool, api, llm, notification)
├── db/                   # Database layer (Drizzle ORM + PostgreSQL)
├── llm/                  # LLM Engine (Vercel AI SDK — multi-provider)
├── tools/                # Tool Registry + built-in tools (stock, weather, calculator, etc.)
├── agent/                # Agent Orchestrator (LangGraph + LangChain)
├── worker/               # Background worker (BullMQ — persistent task monitoring)
└── server/               # Fastify API server + route handlers
```

## Prerequisites

- **Node.js** ≥ 20
- **PostgreSQL** — local or remote
- **Redis** — for the BullMQ background worker

## Local Setup

### 1. Clone & install

```bash
git clone <repo-url> && cd Eventra
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your database URL and optionally configure Redis:

```env
DATABASE_URL=postgresql://localhost:5432/eventra
PORT=3008
HOST=0.0.0.0
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 3. Set up the database

```bash
npm run db:push
```

### 4. Start the API server

```bash
npm run dev
```

The API server starts at **http://localhost:3008** with Swagger docs at **http://localhost:3008/docs**.

### 5. Start the background worker (optional)

In a separate terminal:

```bash
npm run dev:worker
```

The worker processes persistent monitoring tasks via BullMQ.

## Configuring an LLM Provider

Eventra supports multiple LLM providers. Configure one at runtime via the API:

```bash
curl -X PUT http://localhost:3008/llm/config \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "apiKey": "sk-...",
    "model": "gpt-4o"
  }'
```

Supported providers: `openai`, `anthropic`, `google`, `mistral`, `ollama`

List all providers and their models:

```bash
curl http://localhost:3008/llm/providers
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start API server (tsx watch) |
| `npm run dev:worker` | Start background worker (tsx watch) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled API server |
| `npm run start:worker` | Run compiled background worker |
| `npm run lint` | Type-check with `tsc --noEmit` |
| `npm run db:push` | Push schema to database |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:studio` | Open Drizzle Studio |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/agent/message` | Send a message to the agent |
| `GET` | `/tools` | List registered tools |
| `POST` | `/tools/:name/execute` | Execute a tool manually |
| `GET` | `/tasks` | List all tasks |
| `GET` | `/llm/providers` | List LLM providers |
| `GET` | `/llm/config` | Get current LLM config |
| `PUT` | `/llm/config` | Set LLM provider |
| `POST` | `/llm/test` | Test LLM connection |

Full interactive docs available at `/docs` (Swagger UI).
