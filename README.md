# DecidePlease

A deliberation platform where multiple AI models collaborate to answer your questions. Instead of asking one AI, ask a council.

## How It Works

When you submit a question, DecidePlease runs a 3-stage deliberation process:

1. **Stage 1: Individual Responses** - Your question is sent to multiple LLMs (GPT-5.1, Gemini 3 Pro, Claude Sonnet 4.5, Grok 4). Each responds independently.

2. **Stage 2: Peer Review** - Each model reviews and ranks the other responses. Identities are anonymized to prevent bias.

3. **Stage 3: Synthesis** - A chairman model synthesizes all responses and rankings into a final, comprehensive answer.

## Acknowledgments

This project is a fork of [Andrej Karpathy's llm-council](https://github.com/karpathy/llm-council). Thank you Andrej for the original inspiration and implementation! The core concept of anonymized peer review among LLMs comes directly from his work.

## Deployment

DecidePlease is designed to run on [Render](https://render.com) with:
- FastAPI backend
- React frontend
- PostgreSQL database
- Clerk authentication

See [SETUP.md](SETUP.md) for complete deployment instructions.

## Tech Stack

- **Backend:** FastAPI (Python 3.10+), asyncpg, OpenRouter API
- **Frontend:** React 19 + Vite, Clerk React SDK
- **Database:** PostgreSQL
- **Auth:** Clerk (email + Google/Apple OAuth)
- **LLM Access:** OpenRouter

## Local Development

### Prerequisites

- Python 3.10+
- Node.js 18+
- OpenRouter API key

### Quick Start

1. **Install dependencies:**

```bash
# Backend
pip install -r requirements.txt

# Frontend
cd frontend && npm install && cd ..
```

2. **Configure environment:**

Create `backend/.env`:
```
OPENROUTER_API_KEY=sk-or-v1-...
DEVELOPMENT_MODE=true
```

Create `frontend/.env.development`:
```
VITE_API_URL=http://localhost:8001
```

3. **Run the app:**

```bash
./start.sh
```

Or manually:
```bash
# Terminal 1 - Backend
python -m uvicorn backend.main:app --port 8001

# Terminal 2 - Frontend
cd frontend && npm run dev
```

Open http://localhost:5173

## Configuration

Edit `backend/config.py` to customize the council models:

```python
COUNCIL_MODELS = [
    "openai/gpt-5.1",
    "google/gemini-3-pro-preview",
    "anthropic/claude-sonnet-4.5",
    "x-ai/grok-4",
]

CHAIRMAN_MODEL = "google/gemini-3-pro-preview"
```

## License

MIT
