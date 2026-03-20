# MySubscriptions: GitHub Commit Search & AI Summarizer

A web application that connects to GitHub via OAuth2, retrieves recent commits from any repository, and provides AI-powered summaries for each commit using OpenAI.

## Requirements

1. **OAuth2 Authentication** — Allow users to sign in via GitHub OAuth2 and authorize access to their repositories.
2. **Fetch & Display Items** — Retrieve the last 20 commits from a given repository, showing metadata such as commit message, author, date, and files changed.
3. **AI-Powered Processing** — Provide on-demand summarization for each commit using OpenAI, with prompt injection safeguards.
4. **User Dashboard** — Present a clean, usable interface displaying original commit metadata alongside AI-generated summaries.

## Architecture

See [architecture.md](architecture.md) for detailed sequence diagrams covering:
1. OAuth2 Login Flow
2. Commit Search Flow
3. AI Summarize Flow

> To view the diagrams, open `architecture.md` with a Mermaid preview extension (e.g., "Markdown Preview Mermaid Support" in VS Code).

## Tech Stack

| Layer     | Technology              |
|-----------|-------------------------|
| Frontend  | Next.js 16, React 19, Tailwind CSS |
| Backend   | Python, FastAPI          |
| AI        | OpenAI (gpt-5-nano)     |
| Auth      | GitHub OAuth2            |
| Hosting   | Vercel                   |
| Testing   | Jest + React Testing Library (frontend), pytest (backend) |

## Project Structure

```
searchAndSummarize/
├── api/
│   ├── index.py              # FastAPI routes (OAuth callback, commits, summarize)
│   ├── requirements.txt
│   ├── summarizer/
│   │   ├── agent.py           # OpenAI summarization agent
│   │   └── context.py         # System prompt and prompt builder
│   └── tests/
│       ├── __init__.py
│       └── test_api.py        # Backend unit tests
├── frontend/
│   ├── app/
│   │   ├── globals.css
│   │   ├── home/
│   │   │   ├── page.tsx       # Main dashboard (OAuth, search, summarize)
│   │   │   └── __test__/
│   │   │       └── page.test.tsx  # Frontend unit tests
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── jest.config.ts
│   ├── next.config.ts
│   ├── tsconfig.json
│   └── package.json
├── .env.sample                # Root environment variables template
├── architecture.md            # Sequence diagrams (Login, Search, Summarize)
├── vercel.json                # Vercel routing config
└── README.md
```

## AI/NLP Implementation

The summarization feature uses OpenAI's `gpt-5-nano` model via the Chat Completions API.The model version is kept configurable to support observability later. Each commit's metadata — message, author, date, and files changed — is assembled into a structured prompt by `build_prompt()` and sent alongside a system prompt that defines the model's role as a Git Commit Summarizer. The system prompt enforces strict output constraints (under 75 tokens, plain text only) and includes prompt injection defenses: if a commit message contains embedded instructions or adversarial input, the model is instructed to respond with a safe fallback rather than follow the injected prompt. Additionally, the system prompt enforces fairness guidelines — neutral, unbiased language with no judgments about code quality or developer background — to ensure safe and professional AI-generated output.

## Features

- **GitHub OAuth2 Login** — Secure authentication with `repo` scope
- **Commit Search** — Fetch the last 20 commits from any GitHub repository with file-level detail
- **AI Summarization** — One-click commit summaries powered by OpenAI, with prompt injection protection and bias-aware system prompts
- **API Key Protection** — Summarization endpoint is gated behind an API key to prevent unauthorized LLM usage

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+
- GitHub OAuth App ([create one here](https://github.com/settings/developers))
- OpenAI API key

### Environment Variables

Create `api/.env`:

```env
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
X_API_KEY=your_api_key_for_summarizer
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=LLM model
```

Create `frontend/.env.local` (add values to match `.env.sample`):

```env
NEXT_PUBLIC_GITHUB_CLIENT_ID=your_github_client_id
```

### Run Locally

**Backend:**

```bash
cd api
pip3 install -r requirements.txt
uvicorn index:app --reload --port 8000
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000/home](http://localhost:3000/home)

> The frontend proxies `/api/*` requests to `localhost:8000` via Next.js rewrites (development only).

### Run Tests

**Backend:**

```bash
cd api
pip install pytest httpx
pytest tests/ -v
```

**Frontend:**

```bash
cd frontend
npm test
```

## Deployment

Hosted on Vercel. The `vercel.json` routes `/api/*` to the Python backend and everything else to the Next.js frontend.

```bash
vercel --prod
```

Set environment variables in Vercel Dashboard > Settings > Environment Variables.

## Security Considerations

- GitHub tokens are stored client-side in `localStorage` — acceptable for this scope, but a production app should use `httpOnly` cookies with a BFF (Backend-for-Frontend) pattern
- The `/api/github/summarize` endpoint requires an `x-api-key` header to prevent unauthorized LLM usage and cost escalation
- The summarizer system prompt includes prompt injection defenses — malicious commit messages are rejected with a safe fallback response
- The system prompt enforces neutral, unbiased language in all AI outputs

## Design Decisions

- **Separate search and summarize actions**: Summarization is on-demand per commit rather than automatic, keeping LLM costs predictable and giving users control
- **FastAPI + Next.js split**: The Python backend handles OAuth token exchange and GitHub API calls, keeping secrets server-side. The Next.js frontend is purely client-rendered
- **Vercel environment detection**: `load_dotenv` is skipped on Vercel (where env vars are injected), avoiding file-system dependencies in serverless functions

## Future Enhancements

### 1 Day
- Add error toasts and loading skeletons in the UI
- Add keyword extraction alongside summarization
- Add CORS configuration and custom exception handlers
- Add input/output token budgets to prevent cost blowup on large diffs

### 5 Days
- Include actual code diffs in summarization context (with due diligence on sensitive code before sending to LLM)
- Add a second OAuth provider (e.g., Google Calendar or Reddit) to demonstrate multi-service connectivity
- Implement `httpOnly` cookie-based auth with a BFF proxy for production-grade security
- Add toxicity and bias detection on LLM outputs
- Add filters and search across commits (by author, date range, file path)

### 20 Days
- Migrate to AWS (ECS/Lambda + RDS + CloudFront) for scalability and cost control
- Set up observability: structured logging, distributed tracing, LLM call monitoring
- Build a golden dataset and evaluation pipeline to measure summarization quality (accuracy, hallucination rate)
- Implement caching layer (Redis) for GitHub API responses and LLM results
- Add rate limiting and usage tracking per user
- Support multi-repo dashboards with cross-repo insights
- Migrate to LangGraph for complex multi-agent workflows (security scanning, code quality analysis, impact detection)