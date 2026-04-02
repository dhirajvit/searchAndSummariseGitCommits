### Feature - Add OpenAI Authentication Screen - task(addOpenAIAuth)
Users need a way to provide their own OpenAI API key to use the summarization feature.
A dedicated screen/UI should allow the user to enter and manage their OpenAI key, stored in localStorage.

### Requirements
- Add a "Connect OpenAI" button in the nav bar
- User can enter their OpenAI API key via a prompt dialog
- Store the key in localStorage under "openai_token"
- Show "OpenAI Connected" state when key is present
- Allow user to disconnect (remove key from localStorage)
- Pass the key to the backend via `x-openai-token` header on summarize requests
- Backend uses the user-provided key (no server-side fallback)
- Disable the Summarize button when OpenAI is not connected

### API Contract
@app.post("/api/github/summarize")
- Header: `x-openai-token` (required)

### Acceptance Criteria
- User can connect their OpenAI key from the nav bar
- Key persists in localStorage across page reloads
- Summarize requests use the user's own OpenAI key
- No OpenAI key is stored or used server-side
- Summarize button is disabled until OpenAI is connected
