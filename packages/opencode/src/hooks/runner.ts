import { existsSync, readFileSync } from "fs"
import { spawn } from "child_process"
import { homedir } from "os"
import { join } from "path"
import { Hooks } from "./index"

const DEFAULT_SETTINGS = join(homedir(), ".sricode", "settings.json")

export class HookRunner {
  private config: Hooks.Schema

  constructor(private settingsPath = DEFAULT_SETTINGS) {
    this.config = this.load()
  }

  private load(): Hooks.Schema {
    const empty: Hooks.Schema = { hooks: { PreToolUse: [], PostToolUse: [], Stop: [] } }
    if (!existsSync(this.settingsPath)) return empty
    try {
      const raw = JSON.parse(readFileSync(this.settingsPath, "utf8"))
      const parsed = Hooks.Schema.parse(raw)
      // Ensure all hook arrays exist even if zod defaults don't fill them in nested objects
      return {
        hooks: {
          PreToolUse: parsed.hooks?.PreToolUse ?? [],
          PostToolUse: parsed.hooks?.PostToolUse ?? [],
          Stop: parsed.hooks?.Stop ?? [],
        },
      }
    } catch {
      return empty
    }
  }

  private exec(command: string, env?: Record<string, string>): Promise<Hooks.RunResult> {
    return new Promise((resolve) => {
      const proc = spawn("sh", ["-c", command], {
        env: { ...process.env, ...env },
        stdio: ["ignore", "pipe", "pipe"],
      })
      let output = ""
      proc.stdout.on("data", (d: Buffer) => (output += d.toString()))
      proc.stderr.on("data", (d: Buffer) => (output += d.toString()))
      proc.on("close", (code: number | null) => {
        resolve({ output: output.trim(), blocked: (code ?? 0) !== 0, exitCode: code ?? 0 })
      })
    })
  }

  private matches(hook: Hooks.HookEntry, toolName: string): boolean {
    return !hook.matcher || hook.matcher === "*" || hook.matcher === toolName
  }

  async runPreToolUse(toolName: string, input: Record<string, unknown>): Promise<Hooks.RunResult> {
    const hooks = this.config.hooks.PreToolUse.filter((h) => this.matches(h, toolName))
    if (hooks.length === 0) return { output: "", blocked: false, exitCode: 0 }
    const env = { SRICODE_TOOL: toolName, SRICODE_TOOL_INPUT: JSON.stringify(input) }
    let last: Hooks.RunResult = { output: "", blocked: false, exitCode: 0 }
    for (const hook of hooks) {
      const result = await this.exec(hook.command, env)
      if (result.blocked) return result
      last = result
    }
    return last
  }

  async runPostToolUse(toolName: string, output: unknown): Promise<Hooks.RunResult> {
    const hooks = this.config.hooks.PostToolUse.filter((h) => this.matches(h, toolName))
    if (hooks.length === 0) return { output: "", blocked: false, exitCode: 0 }
    const env = { SRICODE_TOOL: toolName, SRICODE_TOOL_OUTPUT: JSON.stringify(output) }
    let last: Hooks.RunResult = { output: "", blocked: false, exitCode: 0 }
    for (const hook of hooks) {
      const result = await this.exec(hook.command, env)
      if (result.blocked) return result
      last = result
    }
    return last
  }

  async runStop(): Promise<Hooks.RunResult[]> {
    return Promise.all(this.config.hooks.Stop.map((h) => this.exec(h.command)))
  }
}
