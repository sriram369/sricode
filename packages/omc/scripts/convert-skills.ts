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
      const name = basename(entry.name, ".md")
      const content = await readFile(skillPath, "utf8")
      const outDir = join(OUT_DIR, name)
      await mkdir(outDir, { recursive: true })
      await writeFile(join(outDir, "SKILL.md"), toSkillMd(name, content))
      console.log(`✓ converted ${name}`)
    } else if (entry.isDirectory()) {
      // Try index.md or SKILL.md inside
      for (const candidate of ["SKILL.md", "index.md"]) {
        try {
          const content = await readFile(join(skillPath, candidate), "utf8")
          const outDir = join(OUT_DIR, entry.name)
          await mkdir(outDir, { recursive: true })
          await writeFile(join(outDir, "SKILL.md"), toSkillMd(entry.name, content))
          console.log(`✓ converted ${entry.name} (dir)`)
          break
        } catch {
          // try next candidate
        }
      }
    }
  }
}

function toSkillMd(name: string, content: string): string {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
  let description = `OMC skill: ${name}`

  if (fmMatch) {
    const descMatch = fmMatch[1].match(/description:\s*(.+)/)
    if (descMatch) description = descMatch[1].trim()
    content = content.slice(fmMatch[0].length).trimStart()
  }

  return `---\nname: ${name}\ndescription: ${description}\n---\n\n${content}`
}

await convert()
console.log("Done.")
