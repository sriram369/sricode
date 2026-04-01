import { describe, expect, it, afterEach } from "bun:test"
import { HookRunner } from "../src/hooks/runner"
import { unlink } from "fs/promises"
import { tmpdir } from "os"
import { join } from "path"
import { writeFile } from "fs/promises"

const tmpConfig = join(tmpdir(), `sricode-test-settings-${Date.now()}.json`)

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

  it("wildcard matcher * matches all tools", async () => {
    await writeFile(tmpConfig, JSON.stringify({
      hooks: {
        PreToolUse: [{ matcher: "*", command: "echo wildcard" }]
      }
    }))
    const runner = new HookRunner(tmpConfig)
    const result = await runner.runPreToolUse("Write", { path: "/tmp/x" })
    expect(result.output).toContain("wildcard")
  })

  it("runs Stop hooks and returns results array", async () => {
    await writeFile(tmpConfig, JSON.stringify({
      hooks: {
        Stop: [{ command: "echo stop-hook-ran" }]
      }
    }))
    const runner = new HookRunner(tmpConfig)
    const results = await runner.runStop()
    expect(results.length).toBe(1)
    expect(results[0].output).toContain("stop-hook-ran")
  })

  it("returns empty results when no settings file exists", async () => {
    const runner = new HookRunner("/nonexistent/path/settings.json")
    const result = await runner.runPreToolUse("Bash", { command: "ls" })
    expect(result.blocked).toBe(false)
    expect(result.output).toBe("")
  })

  it("runs a PostToolUse hook with tool output in env", async () => {
    await writeFile(tmpConfig, JSON.stringify({
      hooks: {
        PostToolUse: [{ matcher: "Read", command: "echo post-hook-ran" }]
      }
    }))
    const runner = new HookRunner(tmpConfig)
    const result = await runner.runPostToolUse("Read", { content: "file contents" })
    expect(result.output).toContain("post-hook-ran")
    expect(result.blocked).toBe(false)
  })
})
