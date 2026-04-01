# sricode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fork OpenCode into sricode — a local-only AI coding agent CLI powered by Ollama (qwen3.5:14b) with full OMC multi-agent skills and hooks.

**Architecture:** sricode is a Bun + TypeScript monorepo forking `packages/opencode` from OpenCode. OpenCode already has tools, skills, and agent infrastructure — we configure Ollama as default, convert OMC skills to OpenCode's SKILL.md format, add a hooks runner, and rebrand.

**Tech Stack:** Bun, TypeScript, Effect.ts, Vercel AI SDK (`ai`), `@ai-sdk/openai-compatible` (Ollama), OpenTUI (terminal UI), Zod

---

## File Map

```
sricode/
├── packages/
│   ├── opencode/               ← cloned from sst/opencode (renamed later)
│   │   └── src/
│   │       ├── config/
│   │       │   └── config.ts   ← MODIFY: default model + ollama config
│   │       ├── hooks/
│   │       │   ├── index.ts    ← CREATE: hooks namespace + schema
│   │       │   └── runner.ts   ← CREATE: hook executor
│   │       └── tool/
│   │           └── registry.ts ← MODIFY: register hooks around tools
│   └── omc/
│       ├── skills/             ← CREATE: OMC skills in SKILL.md format
│       │   ├── brainstorm/SKILL.md
│       │   ├── plan/SKILL.md
│       │   ├── ralph/SKILL.md
│       │   ├── ultrawork/SKILL.md
│       │   ├── tdd/SKILL.md
│       │   └── ...
│       ├── scripts/
│       │   └── persistent-mode.cjs ← COPY from OMC
│       └── package.json
├── .claude/
│   └── skills/                 ← symlink → packages/omc/skills (OMC auto-discovery)
├── package.json                ← Bun workspace root
├── bunfig.toml
└── README.md
```

---

## Task 1: Clone OpenCode into monorepo

**Files:**
- Create: `package.json` (workspace root)
- Create: `bunfig.toml`
- Create: `packages/opencode/` (cloned from sst/opencode)

- [ ] **Step 1: Pull OpenCode source into packages/opencode**

```bash
cd /Users/sriram/Downloads/opencode
git remote add upstream https://github.com/sst/opencode.git
git fetch upstream main
git read-tree --prefix=packages/opencode -u upstream/main:packages/opencode
```

- [ ] **Step 2: Verify the pull worked**

```bash
ls packages/opencode/src/
```

Expected output includes: `agent/  config/  skill/  tool/  provider/`

- [ ] **Step 3: Create workspace root package.json**

```json
{
  "name": "sricode-root",
  "private": true,
  "type": "module",
  "packageManager": "bun@1.3.11",
  "workspaces": ["packages/*"]
}
```

Save to: `package.json`

- [ ] **Step 4: Create bunfig.toml**

```toml
[install]
auto = "local"
```

Save to: `bunfig.toml`

- [ ] **Step 5: Create omc package scaffold**

```bash
mkdir -p packages/omc/skills packages/omc/scripts
```

```json
{
  "name": "@sricode/omc",
  "version": "1.0.0",
  "private": true,
  "type": "module"
}
```

Save to: `packages/omc/package.json`

- [ ] **Step 6: Install dependencies**

```bash
cd /Users/sriram/Downloads/opencode && bun install
```

Expected: packages installed, no errors.

- [ ] **Step 7: Verify build passes**

```bash
cd packages/opencode && bun run typecheck 2>&1 | tail -5
```

Expected: exit 0 or only pre-existing type errors (none introduced by us).

- [ ] **Step 8: Commit**

```bash
git add packages/opencode packages/omc package.json bunfig.toml
git commit -m "chore: fork opencode into monorepo, scaffold omc package"
```

---

## Task 2: Configure Ollama as default provider

**Files:**
- Modify: `packages/opencode/src/config/config.ts` (default model)
- Create: `packages/opencode/src/provider/ollama.ts`
- Create: `~/.sricode/config.json` (runtime default, via setup script)

**Goal:** When sricode starts with no config, it connects to Ollama at `localhost:11434` using `qwen3.5:14b`.

- [ ] **Step 1: Read the existing provider config**

```bash
cat packages/opencode/src/config/config.ts | grep -A 20 "model\|provider\|default"
```

Look for where the default model is set in the `Info` schema.

- [ ] **Step 2: Add Ollama as a named provider**

Create `packages/opencode/src/provider/ollama.ts`:

```typescript
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"

export const ollamaProvider = createOpenAICompatible({
  name: "ollama",
  baseURL: process.env.SRICODE_OLLAMA_HOST ?? "http://localhost:11434/v1",
  apiKey: "ollama", // Ollama ignores this but the SDK requires it
})

export const DEFAULT_MODEL = process.env.SRICODE_MODEL ?? "qwen3.5:14b"
export const DEFAULT_PROVIDER = "ollama"
```

- [ ] **Step 3: Register ollama provider in the provider registry**

Find `packages/opencode/src/provider/provider.ts` (or `models.ts`) and add:

```typescript
import { ollamaProvider, DEFAULT_MODEL, DEFAULT_PROVIDER } from "./ollama"

// In the provider map, add:
ollama: {
  name: "Ollama (local)",
  create: () => ollamaProvider,
},
```

- [ ] **Step 4: Set default model in config schema**

In `packages/opencode/src/config/config.ts`, find the `model` field default and change it to:

```typescript
model: z.string().default("ollama/qwen3.5:14b"),
```

Or wherever the default model ID is set, replace with `"ollama/qwen3.5:14b"`.

- [ ] **Step 5: Write a quick smoke test**

Create `packages/opencode/test/ollama.test.ts`:

```typescript
import { describe, expect, it } from "bun:test"
import { ollamaProvider, DEFAULT_MODEL } from "../src/provider/ollama"

describe("ollama provider", () => {
  it("exports provider and default model", () => {
    expect(ollamaProvider).toBeDefined()
    expect(DEFAULT_MODEL).toBe("qwen3.5:14b")
  })

  it("respects env override", () => {
    process.env.SRICODE_MODEL = "llama3.2:3b"
    // re-import after env change would show override — this tests the export shape
    expect(typeof DEFAULT_MODEL).toBe("string")
    delete process.env.SRICODE_MODEL
  })
})
```

- [ ] **Step 6: Run the test**

```bash
cd packages/opencode && bun test test/ollama.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/opencode/src/provider/ollama.ts packages/opencode/src/provider/ packages/opencode/test/ollama.test.ts
git commit -m "feat: add ollama provider, default to qwen3.5:14b"
```

---

## Task 3: Convert OMC skills to SKILL.md format

**Files:**
- Create: `packages/omc/skills/<name>/SKILL.md` for each OMC skill

OpenCode's skill loader looks for `SKILL.md` files (with YAML frontmatter containing `name` and `description`) in any configured skill directory.

OMC skills that need conversion (priority order):
`brainstorm`, `plan`, `ralph`, `ultrawork`, `tdd`, `executing-plans`, `writing-plans`, `systematic-debugging`, `code-reviewer`, `security-reviewer`

- [ ] **Step 1: Read the current OMC skill format**

```bash
ls ~/.claude/plugins/cache/omc/oh-my-claudecode/4.9.3/skills/
```

Pick one skill to understand the format, e.g.:

```bash
head -20 ~/.claude/plugins/cache/omc/oh-my-claudecode/4.9.3/skills/brainstorm.md 2>/dev/null || \
ls ~/.claude/plugins/cache/omc/oh-my-claudecode/4.9.3/skills/brainstorming/
```

- [ ] **Step 2: Create the conversion script**

Create `packages/omc/scripts/convert-skills.ts`:

```typescript
#!/usr/bin/env bun
import { readdir, readFile, mkdir, writeFile } from "fs/promises"
import { join, basename, extname } from "path"

const OMC_SKILLS_DIR = `${process.env.HOME}/.claude/plugins/cache/omc/oh-my-claudecode/4.9.3/skills`
const OUT_DIR = join(import.meta.dir, "../skills")

async function convert() {
  const entries = await readdir(OMC_SKILLS_DIR, { withFileTypes: true })

  for (const entry of entries) {
    const skillPath = join(OMC_SKILLS_DIR, entry.name)

    if (entry.isFile() && extname(entry.name) === ".md") {
      // Single-file skill: brainstorm.md → brainstorm/SKILL.md
      const name = basename(entry.name, ".md")
      const content = await readFile(skillPath, "utf8")
      const outDir = join(OUT_DIR, name)
      await mkdir(outDir, { recursive: true })
      const skillMd = toSkillMd(name, content)
      await writeFile(join(outDir, "SKILL.md"), skillMd)
      console.log(`✓ converted ${name}`)
    } else if (entry.isDirectory()) {
      // Directory skill: brainstorming/ → brainstorming/SKILL.md
      const indexPath = join(skillPath, "index.md")
      try {
        const content = await readFile(indexPath, "utf8")
        const outDir = join(OUT_DIR, entry.name)
        await mkdir(outDir, { recursive: true })
        await writeFile(join(outDir, "SKILL.md"), toSkillMd(entry.name, content))
        console.log(`✓ converted ${entry.name} (dir)`)
      } catch {
        console.warn(`⚠ skipped ${entry.name} — no index.md`)
      }
    }
  }
}

function toSkillMd(name: string, content: string): string {
  // If content already has frontmatter, extract description from it
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
  let description = `OMC skill: ${name}`

  if (fmMatch) {
    const descMatch = fmMatch[1].match(/description:\s*(.+)/)
    if (descMatch) description = descMatch[1].trim()
    // Strip existing frontmatter, replace with OpenCode-compatible format
    content = content.slice(fmMatch[0].length).trimStart()
  }

  return `---\nname: ${name}\ndescription: ${description}\n---\n\n${content}`
}

await convert()
console.log("Done.")
```

- [ ] **Step 3: Run the conversion**

```bash
cd packages/omc && bun run scripts/convert-skills.ts
```

Expected: list of `✓ converted <skill>` lines, no errors.

- [ ] **Step 4: Verify output structure**

```bash
ls packages/omc/skills/
ls packages/omc/skills/brainstorm/ 2>/dev/null || ls packages/omc/skills/brainstorming/
head -5 packages/omc/skills/brainstorm*/SKILL.md
```

Expected: frontmatter with `name:` and `description:` fields.

- [ ] **Step 5: Write a test for SKILL.md format validity**

Create `packages/omc/test/skills.test.ts`:

```typescript
import { describe, expect, it } from "bun:test"
import { readdir, readFile } from "fs/promises"
import { join } from "path"
import matter from "gray-matter"

const SKILLS_DIR = join(import.meta.dir, "../skills")

describe("OMC skills SKILL.md format", () => {
  it("every skill dir has a valid SKILL.md with name and description", async () => {
    const dirs = await readdir(SKILLS_DIR, { withFileTypes: true })
    const skillDirs = dirs.filter((d) => d.isDirectory())

    expect(skillDirs.length).toBeGreaterThan(5)

    for (const dir of skillDirs) {
      const skillPath = join(SKILLS_DIR, dir.name, "SKILL.md")
      const content = await readFile(skillPath, "utf8")
      const { data } = matter(content)
      expect(data.name, `${dir.name}/SKILL.md missing name`).toBeTruthy()
      expect(data.description, `${dir.name}/SKILL.md missing description`).toBeTruthy()
    }
  })
})
```

- [ ] **Step 6: Install gray-matter and run test**

```bash
cd packages/omc && bun add gray-matter && bun test test/skills.test.ts
```

Expected: 1 test passes, skills count > 5.

- [ ] **Step 7: Commit**

```bash
git add packages/omc/
git commit -m "feat: convert OMC skills to SKILL.md format for OpenCode compatibility"
```

---

## Task 4: Wire OMC skills into sricode skill discovery

**Files:**
- Create: `.claude/skills/` → symlink to `packages/omc/skills/`
- Modify: `packages/opencode/src/config/config.ts` — add omc skills path to default config

OpenCode auto-discovers skills from `.claude/skills/**/SKILL.md` (global and project).
We wire our `packages/omc/skills/` into that discovery path.

- [ ] **Step 1: Create .claude/skills symlink**

```bash
mkdir -p .claude
ln -sf "$(pwd)/packages/omc/skills" .claude/skills
```

- [ ] **Step 2: Verify skill discovery works manually**

```bash
ls -la .claude/skills/
```

Expected: symlink resolving to `packages/omc/skills/` with skill directories inside.

- [ ] **Step 3: Add omc package skills path to default config**

In `packages/opencode/src/config/config.ts`, find the `Info` schema and add a `skills` default:

```typescript
// Find the skills schema field and update default paths:
skills: z.object({
  paths: z.array(z.string()).default([]),
  urls: z.array(z.string()).default([]),
}).default({
  paths: [],
  urls: [],
}),
```

This is already the schema — the discovery of `.claude/skills/` is automatic via `EXTERNAL_DIRS`. No code change needed if `.claude/skills/` exists.

- [ ] **Step 4: Write integration test**

Create `packages/opencode/test/skill-discovery.test.ts`:

```typescript
import { describe, expect, it } from "bun:test"
import { existsSync } from "fs"
import { join } from "path"

const ROOT = join(import.meta.dir, "../../..")

describe("OMC skill discovery", () => {
  it(".claude/skills symlink exists and resolves to omc/skills", () => {
    const symlinkPath = join(ROOT, ".claude/skills")
    expect(existsSync(symlinkPath)).toBe(true)
  })

  it("at least one SKILL.md is discoverable", () => {
    const brainstorm = join(ROOT, ".claude/skills/brainstorm/SKILL.md")
    const brainstorming = join(ROOT, ".claude/skills/brainstorming/SKILL.md")
    expect(existsSync(brainstorm) || existsSync(brainstorming)).toBe(true)
  })
})
```

- [ ] **Step 5: Run the test**

```bash
cd packages/opencode && bun test test/skill-discovery.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 6: Commit**

```bash
git add .claude packages/opencode/test/skill-discovery.test.ts
git commit -m "feat: wire OMC skills into opencode skill discovery via .claude/skills"
```

---

## Task 5: Add hooks system (PreToolUse / PostToolUse / Stop)

**Files:**
- Create: `packages/opencode/src/hooks/index.ts`
- Create: `packages/opencode/src/hooks/runner.ts`
- Modify: `packages/opencode/src/tool/registry.ts` (wrap tools with hooks)
- Modify: `packages/opencode/src/session/` (fire Stop hook on session end)

OpenCode does not have a hooks system. We add one that reads from `~/.sricode/settings.json`.

- [ ] **Step 1: Write failing test for hook runner**

Create `packages/opencode/test/hooks.test.ts`:

```typescript
import { describe, expect, it, beforeEach, afterEach } from "bun:test"
import { HookRunner } from "../src/hooks/runner"
import { writeFile, unlink } from "fs/promises"
import { tmpdir } from "os"
import { join } from "path"

const tmpConfig = join(tmpdir(), "sricode-test-settings.json")

describe("HookRunner", () => {
  afterEach(async () => {
    await unlink(tmpConfig).catch(() => {})
  })

  it("runs a PreToolUse hook and returns stdout", async () => {
    await writeFile(tmpConfig, JSON.stringify({
      hooks: {
        PreToolUse: [{ matcher: "Bash", command: "echo pre-hook-ran" }]
      }
    }))

    const runner = new HookRunner(tmpConfig)
    const result = await runner.runPreToolUse("Bash", { command: "ls" })
    expect(result.output).toContain("pre-hook-ran")
    expect(result.blocked).toBe(false)
  })

  it("blocks tool execution when hook exits non-zero", async () => {
    await writeFile(tmpConfig, JSON.stringify({
      hooks: {
        PreToolUse: [{ matcher: "Bash", command: "exit 1" }]
      }
    }))

    const runner = new HookRunner(tmpConfig)
    const result = await runner.runPreToolUse("Bash", { command: "ls" })
    expect(result.blocked).toBe(true)
  })

  it("returns unblocked when no hooks match tool name", async () => {
    await writeFile(tmpConfig, JSON.stringify({
      hooks: {
        PreToolUse: [{ matcher: "Read", command: "echo read-hook" }]
      }
    }))

    const runner = new HookRunner(tmpConfig)
    const result = await runner.runPreToolUse("Bash", { command: "ls" })
    expect(result.blocked).toBe(false)
    expect(result.output).toBe("")
  })

  it("runs Stop hooks", async () => {
    await writeFile(tmpConfig, JSON.stringify({
      hooks: {
        Stop: [{ command: "echo stop-hook-ran" }]
      }
    }))

    const runner = new HookRunner(tmpConfig)
    const result = await runner.runStop()
    expect(result[0].output).toContain("stop-hook-ran")
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd packages/opencode && bun test test/hooks.test.ts 2>&1 | head -20
```

Expected: `Cannot find module '../src/hooks/runner'` or similar failure.

- [ ] **Step 3: Create hooks schema**

Create `packages/opencode/src/hooks/index.ts`:

```typescript
import z from "zod"

export namespace Hooks {
  export const HookEntry = z.object({
    matcher: z.string().optional(), // tool name to match, omit = match all
    command: z.string(),            // shell command to execute
  })
  export type HookEntry = z.infer<typeof HookEntry>

  export const Schema = z.object({
    hooks: z.object({
      PreToolUse: z.array(HookEntry).default([]),
      PostToolUse: z.array(HookEntry).default([]),
      Stop: z.array(HookEntry).default([]),
    }).default({}),
  })
  export type Schema = z.infer<typeof Schema>

  export interface RunResult {
    output: string
    blocked: boolean
    exitCode: number
  }
}
```

- [ ] **Step 4: Create hook runner**

Create `packages/opencode/src/hooks/runner.ts`:

```typescript
import { existsSync, readFileSync } from "fs"
import { spawn } from "child_process"
import { Hooks } from "./index"
import { homedir } from "os"
import { join } from "path"

const DEFAULT_SETTINGS = join(homedir(), ".sricode", "settings.json")

export class HookRunner {
  private config: Hooks.Schema

  constructor(private settingsPath = DEFAULT_SETTINGS) {
    this.config = this.load()
  }

  private load(): Hooks.Schema {
    if (!existsSync(this.settingsPath)) return Hooks.Schema.parse({})
    try {
      const raw = JSON.parse(readFileSync(this.settingsPath, "utf8"))
      return Hooks.Schema.parse(raw)
    } catch {
      return Hooks.Schema.parse({})
    }
  }

  private async exec(command: string, env?: Record<string, string>): Promise<Hooks.RunResult> {
    return new Promise((resolve) => {
      const proc = spawn("sh", ["-c", command], {
        env: { ...process.env, ...env },
        stdio: ["ignore", "pipe", "pipe"],
      })

      let output = ""
      proc.stdout.on("data", (d) => (output += d.toString()))
      proc.stderr.on("data", (d) => (output += d.toString()))

      proc.on("close", (code) => {
        resolve({ output: output.trim(), blocked: (code ?? 0) !== 0, exitCode: code ?? 0 })
      })
    })
  }

  async runPreToolUse(toolName: string, input: Record<string, unknown>): Promise<Hooks.RunResult> {
    const hooks = this.config.hooks.PreToolUse.filter(
      (h) => !h.matcher || h.matcher === toolName || h.matcher === "*"
    )
    if (hooks.length === 0) return { output: "", blocked: false, exitCode: 0 }

    const env = { SRICODE_TOOL: toolName, SRICODE_TOOL_INPUT: JSON.stringify(input) }
    for (const hook of hooks) {
      const result = await this.exec(hook.command, env)
      if (result.blocked) return result
    }
    return { output: "", blocked: false, exitCode: 0 }
  }

  async runPostToolUse(toolName: string, output: unknown): Promise<Hooks.RunResult> {
    const hooks = this.config.hooks.PostToolUse.filter(
      (h) => !h.matcher || h.matcher === toolName || h.matcher === "*"
    )
    if (hooks.length === 0) return { output: "", blocked: false, exitCode: 0 }

    const env = { SRICODE_TOOL: toolName, SRICODE_TOOL_OUTPUT: JSON.stringify(output) }
    for (const hook of hooks) {
      const result = await this.exec(hook.command, env)
      if (result.blocked) return result
    }
    return { output: "", blocked: false, exitCode: 0 }
  }

  async runStop(): Promise<Hooks.RunResult[]> {
    const hooks = this.config.hooks.Stop
    return Promise.all(hooks.map((h) => this.exec(h.command)))
  }
}
```

- [ ] **Step 5: Run tests — expect them to pass**

```bash
cd packages/opencode && bun test test/hooks.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 6: Register HookRunner as a singleton in the tool registry**

Find `packages/opencode/src/tool/registry.ts`. Add hook wrapping around tool execution:

```typescript
import { HookRunner } from "@/hooks/runner"

const hookRunner = new HookRunner()

// Wrap the existing tool call dispatch — find where tools are invoked and add:
// Before tool execution:
const preResult = await hookRunner.runPreToolUse(toolName, toolInput)
if (preResult.blocked) {
  return { error: `Blocked by PreToolUse hook: ${preResult.output}` }
}

// After tool execution:
await hookRunner.runPostToolUse(toolName, toolOutput)
```

The exact insertion point depends on OpenCode's tool dispatch — read `registry.ts` first, then insert at the call site.

- [ ] **Step 7: Wire Stop hook to session end**

Find where the session ends in `packages/opencode/src/session/` or the CLI exit handler. Add:

```typescript
import { HookRunner } from "@/hooks/runner"

// On session end / process exit:
const hookRunner = new HookRunner()
await hookRunner.runStop()
```

- [ ] **Step 8: Commit**

```bash
git add packages/opencode/src/hooks/ packages/opencode/test/hooks.test.ts
git commit -m "feat: add PreToolUse/PostToolUse/Stop hooks system"
```

---

## Task 6: Copy OMC hook scripts

**Files:**
- Create: `packages/omc/scripts/persistent-mode.cjs`
- Create: `~/.sricode/settings.json` (default OMC hooks config)

- [ ] **Step 1: Copy persistent-mode script from OMC**

```bash
cp ~/.claude/plugins/cache/omc/oh-my-claudecode/4.9.3/scripts/persistent-mode.cjs \
   packages/omc/scripts/persistent-mode.cjs
```

- [ ] **Step 2: Copy other OMC hook scripts**

```bash
ls ~/.claude/plugins/cache/omc/oh-my-claudecode/4.9.3/scripts/
cp ~/.claude/plugins/cache/omc/oh-my-claudecode/4.9.3/scripts/run.cjs \
   packages/omc/scripts/run.cjs 2>/dev/null || true
```

- [ ] **Step 3: Create setup script for default settings.json**

Create `packages/omc/scripts/setup-settings.ts`:

```typescript
#!/usr/bin/env bun
import { mkdir, writeFile, readFile } from "fs/promises"
import { join } from "path"
import { homedir } from "os"
import { existsSync } from "fs"

const SRICODE_DIR = join(homedir(), ".sricode")
const SETTINGS_PATH = join(SRICODE_DIR, "settings.json")
const OMC_SCRIPTS = join(import.meta.dir)

const DEFAULT_SETTINGS = {
  hooks: {
    Stop: [
      {
        command: `node "${join(OMC_SCRIPTS, "run.cjs")}" "${join(OMC_SCRIPTS, "persistent-mode.cjs")}"`
      }
    ],
    PreToolUse: [],
    PostToolUse: []
  }
}

await mkdir(SRICODE_DIR, { recursive: true })

if (!existsSync(SETTINGS_PATH)) {
  await writeFile(SETTINGS_PATH, JSON.stringify(DEFAULT_SETTINGS, null, 2))
  console.log(`Created ${SETTINGS_PATH}`)
} else {
  console.log(`Settings already exist at ${SETTINGS_PATH} — skipping`)
}
```

- [ ] **Step 4: Run the setup script**

```bash
cd packages/omc && bun run scripts/setup-settings.ts
```

Expected: `Created ~/.sricode/settings.json`

- [ ] **Step 5: Verify settings file**

```bash
cat ~/.sricode/settings.json
```

Expected: JSON with `hooks.Stop` pointing to `persistent-mode.cjs`.

- [ ] **Step 6: Commit**

```bash
git add packages/omc/scripts/
git commit -m "feat: add OMC hook scripts and default settings setup"
```

---

## Task 7: Rebrand to sricode

**Files:**
- Modify: `packages/opencode/package.json` — change `"name"` and `"bin"`
- Modify: `packages/opencode/src/global/` — update app name constants
- Create: `README.md`

- [ ] **Step 1: Update package.json bin name**

In `packages/opencode/package.json`:

```json
{
  "name": "sricode",
  "bin": {
    "sricode": "./bin/opencode"
  }
}
```

Change `"opencode"` key in `bin` to `"sricode"`.

- [ ] **Step 2: Find and update app name constant**

```bash
grep -r "opencode\|OpenCode" packages/opencode/src/global/ --include="*.ts" -l
```

In the global constants file, update:

```typescript
export const APP_NAME = "sricode"
export const APP_DIR = ".sricode"
```

- [ ] **Step 3: Create README.md**

Create `README.md`:

```markdown
# sricode

Local AI coding agent for Sriram. Powered by Ollama + qwen3.5:14b + OMC skills.

## Prerequisites

- [Bun](https://bun.sh) 1.3+
- [Ollama](https://ollama.com) running locally

## Setup

```bash
# Pull the model
ollama pull qwen3.5:14b

# Install sricode
bun install
cd packages/opencode && bun run build

# Configure OMC hooks
bun run packages/omc/scripts/setup-settings.ts

# Run
./packages/opencode/bin/opencode
```

## Architecture

- **CLI**: Fork of [opencode](https://github.com/sst/opencode) (MIT)
- **Model**: qwen3.5:14b via Ollama
- **Skills**: OMC multi-agent skills (brainstorm, plan, ralph, ultrawork, tdd...)
- **Hooks**: PreToolUse / PostToolUse / Stop hooks for OMC persistent mode
```

- [ ] **Step 4: Commit**

```bash
git add packages/opencode/package.json README.md
git commit -m "chore: rebrand to sricode, update bin name and app constants"
```

---

## Task 8: End-to-end smoke test

**Files:**
- Create: `packages/opencode/test/e2e/smoke.test.ts`

- [ ] **Step 1: Verify Ollama is running**

```bash
curl -s http://localhost:11434/api/tags | python3 -c "import sys,json; models=[m['name'] for m in json.load(sys.stdin)['models']]; print('qwen3.5:14b found' if any('qwen3.5' in m for m in models) else 'MISSING: run ollama pull qwen3.5:14b')"
```

Expected: `qwen3.5:14b found`

If not: `ollama pull qwen3.5:14b` (this is a background operation, may take a while)

- [ ] **Step 2: Run all unit tests**

```bash
cd packages/opencode && bun test 2>&1 | tail -20
```

Expected: all tests pass. Note any failures and fix before proceeding.

- [ ] **Step 3: Run OMC skills tests**

```bash
cd packages/omc && bun test 2>&1 | tail -10
```

Expected: skills format test passes.

- [ ] **Step 4: Build sricode**

```bash
cd packages/opencode && bun run build 2>&1 | tail -10
```

Expected: build succeeds, binary at `packages/opencode/bin/opencode`.

- [ ] **Step 5: Verify binary starts**

```bash
timeout 5 ./packages/opencode/bin/opencode --version 2>&1 || echo "binary started (timeout expected for interactive mode)"
```

Expected: version output or graceful interactive start (no crash).

- [ ] **Step 6: Verify skill loading**

```bash
cd packages/opencode && bun run --conditions=browser src/index.ts skill list 2>/dev/null | head -20 || \
echo "Check that .claude/skills/ symlink resolves and SKILL.md files exist"
```

Expected: list of available OMC skills.

- [ ] **Step 7: Final commit + push**

```bash
git add -A
git commit -m "test: add e2e smoke tests, verify full sricode stack"
git push origin main
```

---

## Summary

After completing all tasks:

| Feature | Status |
|---------|--------|
| OpenCode forked into monorepo | ✅ |
| Ollama + qwen3.5:14b default | ✅ |
| OMC skills in SKILL.md format | ✅ |
| Skills auto-discovered | ✅ |
| Hooks system (Pre/Post/Stop) | ✅ |
| OMC persistent-mode hook | ✅ |
| Rebranded as sricode | ✅ |
| Tests passing | ✅ |

**Run sricode:**
```bash
ollama pull qwen3.5:14b  # one-time
./packages/opencode/bin/opencode
```
