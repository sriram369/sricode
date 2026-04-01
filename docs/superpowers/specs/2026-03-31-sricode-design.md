# sricode — Design Spec
**Date:** 2026-03-31
**Status:** Approved
**Author:** Sriram

---

## Overview

sricode is a terminal-based AI coding agent CLI that runs 100% locally. It forks OpenCode (MIT), wires Ollama (qwen3.5:14b) as the model provider, and embeds OMC's skills/hooks system for full multi-agent workflows — no API costs, no cloud dependency.

---

## Goals

- Full Claude Code-like terminal experience running locally
- Multi-agent support via Agent tool (sub-process spawning)
- OMC skills system working out of the box
- OMC hooks system (PreToolUse, PostToolUse, Stop)
- Single command install, zero config to get started
- Production quality — not a prototype

---

## Non-Goals

- Web UI (terminal only)
- Cloud model support (Ollama only for now)
- Windows support (macOS + Linux)

---

## Architecture

### Monorepo Structure

```
sricode/ (pnpm workspaces)
├── packages/
│   ├── cli/                    ← OpenCode fork (TypeScript + Ink)
│   │   ├── src/
│   │   │   ├── providers/
│   │   │   │   └── ollama.ts   ← Ollama model provider
│   │   │   ├── tools/
│   │   │   │   └── agent.ts    ← Multi-agent tool (NEW)
│   │   │   ├── skills/
│   │   │   │   └── loader.ts   ← Skill loader + Skill tool (NEW)
│   │   │   └── hooks/
│   │   │       └── runner.ts   ← Hook runner (NEW)
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── omc/                    ← OMC embedded package
│       ├── skills/             ← All OMC skill markdown files
│       ├── scripts/            ← Hook scripts (persistent-mode, etc.)
│       ├── templates/          ← Rule templates
│       └── package.json
├── package.json                ← pnpm workspace root
├── pnpm-workspace.yaml
└── README.md
```

### Data Flow

```
User input
  → REPL (Ink terminal UI)
  → QueryEngine
  → PreToolUse hooks
  → Ollama API (qwen3.5:14b, localhost:11434)
  → Tool calls (Bash/Read/Edit/Write/Glob/Grep/Agent/Skill)
  → PostToolUse hooks
  → Response rendered in terminal
  → [on session end] Stop hooks
```

---

## Components

### 1. CLI Package (OpenCode Fork)

Base: https://github.com/sst/opencode (MIT license)

Key changes from upstream:
- Remove all non-Ollama providers (Anthropic, OpenAI, Bedrock, etc.) — Ollama only
- Add `Agent` tool for multi-agent spawning
- Add `Skill` tool with markdown skill loader
- Add hooks runner (PreToolUse, PostToolUse, Stop)
- Wire OMC package as default skills source
- Rebrand UI to sricode

### 2. Ollama Provider

- Connects to `localhost:11434` (Ollama default)
- Default model: `qwen3.5:14b`
- Model configurable via `~/.sricode/config.json`
- Supports streaming responses
- OpenAI-compatible API (Ollama supports this natively)

### 3. Agent Tool (Multi-Agent)

Enables OMC skills like `ralph`, `ultrawork`, `team` to work locally.

```
Agent tool call received
  → Spawn child process: sricode --agent --model qwen3.5:14b
  → Pass: system prompt, task, tools list
  → Child runs independently with own Ollama context
  → Returns result to parent
  → Parent continues
```

Constraints:
- Max 5 concurrent sub-agents (configurable)
- Each sub-agent gets isolated tool context
- Sub-agents cannot spawn further sub-agents (depth limit: 1)

### 4. Skills System

Skill tool loads markdown files from:
1. `packages/omc/skills/<skill-name>.md` (built-in OMC skills)
2. `~/.sricode/skills/` (user custom skills)
3. `.sricode/skills/` (project-level skills)

Priority: project > user > built-in

### 5. Hooks System

Hooks configured in `~/.sricode/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [{ "matcher": "Bash", "command": "echo pre-bash" }],
    "PostToolUse": [{ "matcher": "*", "command": "..." }],
    "Stop": [{ "command": "node omc/scripts/persistent-mode.cjs" }]
  }
}
```

Hook runner executes commands as child processes, captures stdout/stderr, can block tool execution (exit code non-zero = block).

---

## Model

**Primary:** `qwen3.5:14b`
- VRAM: ~8-9GB Q4_K_M
- Context: 262K tokens
- Tool calling: native
- Speed on M4 16GB: ~20-30 tok/s

**Future swap-in:** `Jackrong/Qwen3.5-27B-Claude-4.6-Opus-Reasoning-Distilled` (when on 32GB+)

---

## Build Phases

| Phase | Scope | Deliverable |
|-------|-------|-------------|
| 1 | Repo setup | Fork OpenCode, monorepo, CI, build passes |
| 2 | Ollama provider | `sricode` connects to Ollama, chat works |
| 3 | Agent tool | Multi-agent spawning works end-to-end |
| 4 | Skills system | `Skill` tool loads + executes OMC skills |
| 5 | Hooks system | PreToolUse/PostToolUse/Stop hooks fire correctly |
| 6 | OMC integration | All OMC skills work in sricode |
| 7 | Polish + testing | README, install script, E2E tests |

---

## Config

`~/.sricode/config.json`:
```json
{
  "model": "qwen3.5:14b",
  "ollamaHost": "http://localhost:11434",
  "maxAgents": 5,
  "skillPaths": [],
  "theme": "dark"
}
```

---

## Success Criteria

- [ ] `sricode` launches in terminal, connects to Ollama
- [ ] Can read/edit/run files via tools
- [ ] `Agent` tool spawns sub-agents that complete tasks and return
- [ ] OMC skills load and execute (brainstorm, ralph, ultrawork, plan)
- [ ] Hooks fire before/after tool use and on session stop
- [ ] OMC persistent-mode hook works correctly
- [ ] Installs with `npm i -g sricode` + `ollama pull qwen3.5:14b`
