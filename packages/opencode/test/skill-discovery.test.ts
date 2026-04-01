import { describe, expect, it } from "bun:test"
import { existsSync, realpathSync } from "fs"
import { join } from "path"

const ROOT = join(import.meta.dir, "../../..")

describe("OMC skill discovery", () => {
  it(".claude/skills symlink exists", () => {
    const symlinkPath = join(ROOT, ".claude/skills")
    expect(existsSync(symlinkPath)).toBe(true)
  })

  it(".claude/skills resolves to packages/omc/skills", () => {
    const symlinkPath = join(ROOT, ".claude/skills")
    const real = realpathSync(symlinkPath)
    const expected = join(ROOT, "packages/omc/skills")
    expect(real).toBe(expected)
  })

  it("at least one OMC SKILL.md is discoverable via symlink", () => {
    const candidates = ["brainstorm", "brainstorming", "plan", "ralph"]
    const found = candidates.some((name) =>
      existsSync(join(ROOT, `.claude/skills/${name}/SKILL.md`))
    )
    expect(found).toBe(true)
  })
})
