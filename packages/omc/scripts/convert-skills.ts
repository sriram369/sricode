#!/usr/bin/env bun
import { readdir, readFile, mkdir, writeFile } from "fs/promises"
import { join, basename, extname } from "path"

const OMC_BASE = `${process.env.HOME}/.claude/plugins/cache/omc/oh-my-claudecode`
const OUT_DIR = join(import.meta.dir, "../skills")

const SKIP_FILES = new Set(["AGENTS.md"])

async function findOmcSkillsDir(): Promise<string> {
  let versions: string[]
  try {
    versions = await readdir(OMC_BASE)
  } catch {
    throw new Error(`OMC not found at ${OMC_BASE}. Is oh-my-claudecode installed?`)
  }
  // Sort semver-ish: pick latest
  const latest = versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true })).at(0)
  if (!latest) throw new Error("No OMC versions found")
  return join(OMC_BASE, latest, "skills")
}

async function convert() {
  const OMC_SKILLS_DIR = await findOmcSkillsDir()
  const entries = await readdir(OMC_SKILLS_DIR, { withFileTypes: true })

  for (const entry of entries) {
    const skillPath = join(OMC_SKILLS_DIR, entry.name)

    if (entry.isFile() && extname(entry.name) === ".md") {
      if (SKIP_FILES.has(entry.name)) continue
      const name = basename(entry.name, ".md")
      const content = await readFile(skillPath, "utf8")
      const outDir = join(OUT_DIR, name)
      await mkdir(outDir, { recursive: true })
      await writeFile(join(outDir, "SKILL.md"), toSkillMd(name, content))
      console.log(`✓ converted ${name}`)
    } else if (entry.isDirectory()) {
      // Try index.md or SKILL.md inside
      let found = false
      for (const candidate of ["SKILL.md", "index.md"]) {
        try {
          const content = await readFile(join(skillPath, candidate), "utf8")
          const outDir = join(OUT_DIR, entry.name)
          await mkdir(outDir, { recursive: true })
          await writeFile(join(outDir, "SKILL.md"), toSkillMd(entry.name, content))
          console.log(`✓ converted ${entry.name} (dir)`)
          found = true
          break
        } catch {
          // try next candidate
        }
      }
      if (!found) {
        console.warn(`⚠ skipped ${entry.name}: no SKILL.md or index.md found`)
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
