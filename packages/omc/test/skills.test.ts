import { describe, expect, it } from "bun:test"
import { readdir, readFile } from "fs/promises"
import { join } from "path"

const SKILLS_DIR = join(import.meta.dir, "../skills")

// Simple frontmatter parser (no external dep needed)
function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  const result: Record<string, string> = {}
  for (const line of match[1].split("\n")) {
    const colonIdx = line.indexOf(":")
    if (colonIdx > 0) {
      result[line.slice(0, colonIdx).trim()] = line.slice(colonIdx + 1).trim()
    }
  }
  return result
}

describe("OMC skills SKILL.md format", () => {
  it("every skill dir has a valid SKILL.md with name and description", async () => {
    const dirs = await readdir(SKILLS_DIR, { withFileTypes: true })
    const skillDirs = dirs.filter((d) => d.isDirectory())

    expect(skillDirs.length).toBeGreaterThan(25)

    for (const dir of skillDirs) {
      const skillPath = join(SKILLS_DIR, dir.name, "SKILL.md")
      const content = await readFile(skillPath, "utf8")
      const fm = parseFrontmatter(content)
      expect(fm.name, `${dir.name}/SKILL.md missing name`).toBeTruthy()
      expect(fm.description, `${dir.name}/SKILL.md missing description`).toBeTruthy()
      // Check that body content exists after the frontmatter
      const bodyStart = content.indexOf("---", 4) // find closing ---
      const body = bodyStart > 0 ? content.slice(bodyStart + 3).trim() : ""
      expect(body.length, `${dir.name}/SKILL.md has empty body`).toBeGreaterThan(0)
    }
  })
})
