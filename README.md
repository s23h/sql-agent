# SQL Agent

A conversational AI assistant for data analysis with SQL queries and Python execution in a secure sandbox.

## Features

- **SQL Queries** - Query DuckDB database with TPC-H sample data
- **Python Execution** - Run Python code in isolated E2B sandbox
- **Visualizations** - Generate charts with matplotlib, saved to sandbox
- **Session Branching** - Steins;Gate style worldlines - branch conversations and sandbox state
- **Persistent Sessions** - Resume conversations with full context

## Quick Start

```bash
# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Fill in API keys in .env

# Run development server
pnpm dev

# Open http://localhost:5173
```

## Environment Variables

```
ANTHROPIC_API_KEY=sk-ant-...     # Claude API
E2B_API_KEY=e2b_...              # Sandbox execution
CLERK_PUBLISHABLE_KEY=pk_...     # Authentication
CLERK_SECRET_KEY=sk_...
VITE_CLERK_PUBLISHABLE_KEY=pk_...
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        React UI                              │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ Sessions │  │    Chat      │  │   Sandbox Files        │ │
│  │ Sidebar  │  │   Messages   │  │   Browser              │ │
│  └──────────┘  └──────────────┘  └────────────────────────┘ │
└─────────────────────────┬───────────────────────────────────┘
                          │ WebSocket
┌─────────────────────────▼───────────────────────────────────┐
│                    Express Server                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ Claude SDK   │  │  E2B Sandbox │  │  DuckDB          │   │
│  │ Agent Loop   │  │  (Python)    │  │  (TPC-H Data)    │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Project Structure

```
├── src/
│   ├── client/          # React frontend
│   │   ├── components/  # UI components
│   │   ├── hooks/       # React hooks
│   │   └── state/       # Jotai atoms
│   └── server/          # Express backend
│       ├── api/         # REST endpoints
│       ├── db/          # Session database
│       ├── sandbox/     # E2B integration
│       └── tools/       # MCP tool servers
├── packages/            # Shared libraries
│   ├── server/          # SDK session management
│   ├── messages/        # Message parsing
│   └── websocket/       # WebSocket handling
└── deploy/              # Deployment scripts
```

## Key Design Decisions

1. **E2B Sandboxing** - All code execution in isolated sandboxes for security
2. **Git-based State** - Sandbox snapshots after each turn enable branching
3. **WebSocket Streaming** - Real-time message streaming for responsive UI
4. **Session Branching** - Fork conversations to explore alternatives

## Live Demo

http://34.60.133.177
