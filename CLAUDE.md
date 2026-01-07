# CLAUDE.md - Technical Notes for DecidePlease

This file contains technical details, architectural decisions, and important implementation notes for future development sessions.

## API Keys & Credentials

**Render API Key:** `rnd_FBZ7HcVTe9eg38SeJfww7ForGyiS`
- Used for: Pulling logs, checking deploy status, managing services
- API docs: https://api-docs.render.com/

**Production Database (Render Postgres):**
```bash
PGPASSWORD=oQXDrJLAnkAJcHDCxzAcMz72hDoOvG40 psql -h dpg-d5bj7ckhg0os73dlb49g-a.oregon-postgres.render.com -p 5432 -U decideplease decideplease
```

## Project Overview

DecidePlease is a 3-stage deliberation system where multiple LLMs collaboratively answer user questions. The key innovation is anonymized peer review in Stage 2, preventing models from playing favorites.

## Architecture

### Backend Structure (`backend/`)

**`config.py`**
- Contains `COUNCIL_MODELS` (list of OpenRouter model identifiers)
- Contains `CHAIRMAN_MODEL` (model that synthesizes final answer)
- Uses environment variable `OPENROUTER_API_KEY` from `.env`
- Backend runs on **port 8001** (NOT 8000 - user had another app on 8000)

**`openrouter.py`**
- `query_model()`: Single async model query
- `query_models_parallel()`: Parallel queries using `asyncio.gather()`
- Returns dict with 'content' and optional 'reasoning_details'
- Graceful degradation: returns None on failure, continues with successful responses

**`council.py`** - The Core Logic
- `stage1_collect_responses()`: Parallel queries to all council models
- `stage2_collect_rankings()`:
  - Anonymizes responses as "Response A, B, C, etc."
  - Creates `label_to_model` mapping for de-anonymization
  - Prompts models to evaluate and rank (with strict format requirements)
  - Returns tuple: (rankings_list, label_to_model_dict)
  - Each ranking includes both raw text and `parsed_ranking` list
- `stage3_synthesize_final()`: Chairman synthesizes from all responses + rankings
- `parse_ranking_from_text()`: Extracts "FINAL RANKING:" section, handles both numbered lists and plain format
- `calculate_aggregate_rankings()`: Computes average rank position across all peer evaluations

**`storage.py`**
- JSON-based conversation storage in `data/conversations/`
- Each conversation: `{id, created_at, messages[]}`
- Assistant messages contain: `{role, stage1, stage2, stage3}`
- Note: metadata (label_to_model, aggregate_rankings) is NOT persisted to storage, only returned via API

**`main.py`**
- FastAPI app with CORS enabled for localhost:5173 and localhost:3000
- POST `/api/conversations/{id}/message` returns metadata in addition to stages
- Metadata includes: label_to_model mapping and aggregate_rankings

### Frontend Structure (`frontend/src/`)

**`App.jsx`**
- Main orchestration: manages conversations list and current conversation
- Handles message sending and metadata storage
- Important: metadata is stored in the UI state for display but not persisted to backend JSON

**`components/ChatInterface.jsx`**
- Multiline textarea (3 rows, resizable)
- Enter to send, Shift+Enter for new line
- User messages wrapped in markdown-content class for padding

**`components/Stage1.jsx`**
- Tab view of individual model responses
- ReactMarkdown rendering with markdown-content wrapper

**`components/Stage2.jsx`**
- **Critical Feature**: Tab view showing RAW evaluation text from each model
- De-anonymization happens CLIENT-SIDE for display (models receive anonymous labels)
- Shows "Extracted Ranking" below each evaluation so users can validate parsing
- Aggregate rankings shown with average position and vote count
- Explanatory text clarifies that boldface model names are for readability only

**`components/Stage3.jsx`**
- Final synthesized answer from chairman
- Green-tinted background (#f0fff0) to highlight conclusion

**Styling (`*.css`)**
- Light mode theme (not dark mode)
- Primary color: #4a90e2 (blue)
- Global markdown styling in `index.css` with `.markdown-content` class
- 12px padding on all markdown content to prevent cluttered appearance

## Key Design Decisions

### Stage 2 Prompt Format
The Stage 2 prompt is very specific to ensure parseable output:
```
1. Evaluate each response individually first
2. Provide "FINAL RANKING:" header
3. Numbered list format: "1. Response C", "2. Response A", etc.
4. No additional text after ranking section
```

This strict format allows reliable parsing while still getting thoughtful evaluations.

### De-anonymization Strategy
- Models receive: "Response A", "Response B", etc.
- Backend creates mapping: `{"Response A": "openai/gpt-5.1", ...}`
- Frontend displays model names in **bold** for readability
- Users see explanation that original evaluation used anonymous labels
- This prevents bias while maintaining transparency

### Error Handling Philosophy
- Continue with successful responses if some models fail (graceful degradation)
- Never fail the entire request due to single model failure
- Log errors but don't expose to user unless all models fail

### UI/UX Transparency
- All raw outputs are inspectable via tabs
- Parsed rankings shown below raw text for validation
- Users can verify system's interpretation of model outputs
- This builds trust and allows debugging of edge cases

## Important Implementation Details

### Relative Imports
All backend modules use relative imports (e.g., `from .config import ...`) not absolute imports. This is critical for Python's module system to work correctly when running as `python -m backend.main`.

### Port Configuration
- Backend: 8001 (changed from 8000 to avoid conflict)
- Frontend: 5173 (Vite default)
- Update both `backend/main.py` and `frontend/src/api.js` if changing

### Markdown Rendering
All ReactMarkdown components must be wrapped in `<div className="markdown-content">` for proper spacing. This class is defined globally in `index.css`.

### Model Configuration
Models are hardcoded in `backend/config.py`. Chairman can be same or different from council members. The current default is Gemini as chairman per user preference.

## Common Gotchas

1. **Module Import Errors**: Always run backend as `python -m backend.main` from project root, not from backend directory
2. **CORS Issues**: Frontend must match allowed origins in `main.py` CORS middleware
3. **Ranking Parse Failures**: If models don't follow format, fallback regex extracts any "Response X" patterns in order
4. **Missing Metadata**: Metadata is ephemeral (not persisted), only available in API responses

## Future Enhancement Ideas

- Configurable council/chairman via UI instead of config file
- Streaming responses instead of batch loading
- Export conversations to markdown/PDF
- Model performance analytics over time
- Custom ranking criteria (not just accuracy/insight)
- Support for reasoning models (o1, etc.) with special handling

## Testing Notes

Use `test_openrouter.py` to verify API connectivity and test different model identifiers before adding to council. The script tests both streaming and non-streaming modes.

## Data Flow Summary

```
User Query
    ↓
Stage 1: Parallel queries → [individual responses]
    ↓
Stage 2: Anonymize → Parallel ranking queries → [evaluations + parsed rankings]
    ↓
Aggregate Rankings Calculation → [sorted by avg position]
    ↓
Stage 3: Chairman synthesis with full context
    ↓
Return: {stage1, stage2, stage3, metadata}
    ↓
Frontend: Display with tabs + validation UI
```

The entire flow is async/parallel where possible to minimize latency.

## Testing Requirements (ALWAYS FOLLOW)

This project uses Playwright for comprehensive testing. Whenever you make ANY changes to the codebase, you MUST:

1. **After adding/modifying features:** Create or update the relevant Playwright tests in the `tests/` folder to cover the changes

2. **After changing routes/URLs:** Update `tests/links/` to reflect new paths

3. **After changing forms:** Update `tests/forms/` with new validation rules and fields

4. **After changing UI/layout:** Update `tests/visual/` baseline screenshots and `tests/responsive/` checks

5. **After adding/changing API endpoints:** Update `tests/api/` with new endpoint tests

6. **After changing auth/permissions:** Update `tests/security/` and relevant e2e tests

7. **After removing features:** Delete the corresponding test files

### Test Structure
- `tests/smoke.spec.js` — Quick health check for deploys
- `tests/e2e/` — User flow tests (auth, conversations, settings)
- `tests/links/` — Link crawler and 404 detection
- `tests/forms/` — Form validation tests
- `tests/visual/` — Screenshot comparison tests
- `tests/responsive/` — Mobile/tablet/desktop tests
- `tests/accessibility/` — a11y tests using axe-core
- `tests/performance/` — Page load time tests
- `tests/console/` — JavaScript error detection
- `tests/api/` — API endpoint tests
- `tests/security/` — Auth and permission tests
- `tests/fixtures/` — Test helpers and utilities

### Commands
```bash
# Run all tests
npx playwright test

# Run specific category
npx playwright test tests/e2e/

# Run single file
npx playwright test tests/e2e/auth.spec.js

# Run smoke tests (before deploy)
npx playwright test tests/smoke.spec.js

# Update visual baselines
npx playwright test tests/visual/ --update-snapshots

# Run with UI mode
npx playwright test --ui

# Run specific browser
npx playwright test --project=chromium
```

### IMPORTANT
- Never skip updating tests. Tests are as important as the feature itself.
- If you're unsure what tests to update, run `npx playwright test` and fix any failures.
- When in doubt, ask the user before deleting tests.
- Visual tests require updating baselines when UI intentionally changes.
- All tests should pass before committing changes.
