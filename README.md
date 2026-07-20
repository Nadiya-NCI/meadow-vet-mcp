# Meadow Vet Care — MCP Server & Chatbot

A customer chatbot for Meadow Vet Care that answers real questions from the clinic's live data.

## Web Chat (GitHub Pages)

Browse and ask questions about the clinic's 90+ services:

**https://your-username.github.io/meadow-vet-mcp**

- **Smart mode** — built-in engine answers from live data (no API key needed)
- **LLM mode** — uses OpenRouter/OpenAI API for natural language (enter your key in settings)

### Quick questions to try:
- "What services do you have for dogs?"
- "How much is a cat vaccination?"
- "Do you have any discounts or offers?"
- "Show me grooming prices"
- "What are your emergency services?"

## MCP Server

JSON-RPC MCP server for AI clients (Claude Desktop, etc.).

### Tools

| Tool | Description |
|---|---|
| `search-services` | Search by species, category, keyword, price range, availability |
| `get-summary` | Overview: totals, categories, species, current offers |
| `get-available-slots` | Find services with available slots this week |

### Usage

```json
{
  "mcpServers": {
    "meadow-vet": {
      "command": "node",
      "args": ["path/to/meadow-vet-mcp/index.js"]
    }
  }
}
```

## Local Development

```bash
npm start          # Run MCP server
```

Data source: [Google Sheet](https://docs.google.com/spreadsheets/d/1JhSODtviGHzXru6Eb5MhfXfVIF5vtJk3pclzzv7j2l4/edit?gid=1277715587)
