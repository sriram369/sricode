import { describe, expect, it } from "bun:test"
import { existsSync, readdirSync, readFileSync, realpathSync } from "fs"
import { join } from "path"
import { homedir } from "os"

const ROOT = join(import.meta.dir, "../../../..")

describe("sricode smoke tests", () => {
  it("sricode bin exists", () => {
    const binPath = join(ROOT, "packages/opencode/bin/opencode")
    expect(existsSync(binPath)).toBe(true)
  })

  it("OMC skills are discoverable via .claude/skills symlink", () => {
    const skillsPath = join(ROOT, ".claude/skills")
    expect(existsSync(skillsPath)).toBe(true)
    const real = realpathSync(skillsPath)
    expect(real).toBe(join(ROOT, "packages/omc/skills"))
  })

  it("at least 25 OMC skills are available", () => {
    const skills = readdirSync(join(ROOT, "packages/omc/skills"), { withFileTypes: true }).filter((d) =>
      d.isDirectory(),
    )
    expect(skills.length).toBeGreaterThan(25)
  })

  it("hooks settings file exists at ~/.sricode/settings.json", () => {
    const settingsPath = join(homedir(), ".sricode", "settings.json")
    expect(existsSync(settingsPath)).toBe(true)
  })

  it("hooks settings has Stop hook with persistent-mode.cjs", () => {
    const settingsPath = join(homedir(), ".sricode", "settings.json")
    const settings = JSON.parse(readFileSync(settingsPath, "utf8"))
    expect(settings.hooks?.Stop?.length).toBeGreaterThan(0)
    expect(settings.hooks.Stop[0].command).toContain("persistent-mode.cjs")
  })

  it("ollama provider configured with qwen3.5:14b and localhost:11434", () => {
    const providerPath = join(ROOT, "packages/opencode/src/provider/ollama.ts")
    expect(existsSync(providerPath)).toBe(true)
    const content = readFileSync(providerPath, "utf8")
    expect(content).toContain("qwen3.5:14b")
    expect(content).toContain("localhost:11434")
  })

  it("hooks runner module exports HookRunner class", () => {
    const runnerPath = join(ROOT, "packages/opencode/src/hooks/runner.ts")
    expect(existsSync(runnerPath)).toBe(true)
    const content = readFileSync(runnerPath, "utf8")
    expect(content).toContain("export class HookRunner")
  })

  it("sricode bin command is registered in package.json", () => {
    const pkgPath = join(ROOT, "packages/opencode/package.json")
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))
    expect(pkg.bin?.sricode).toBeDefined()
  })
})
