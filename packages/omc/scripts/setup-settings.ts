#!/usr/bin/env bun
/**
 * Sets up ~/.sricode/settings.json with default OMC hooks.
 * Run once after cloning: bun run packages/omc/scripts/setup-settings.ts
 */
import { mkdir, writeFile } from "fs/promises"
import { join } from "path"
import { homedir } from "os"
import { existsSync } from "fs"

const SRICODE_DIR = join(homedir(), ".sricode")
const SETTINGS_PATH = join(SRICODE_DIR, "settings.json")
const OMC_SCRIPTS = join(import.meta.dir)

const RUN_SCRIPT = join(OMC_SCRIPTS, "run.cjs")
const PERSISTENT_MODE_SCRIPT = join(OMC_SCRIPTS, "persistent-mode.cjs")

const DEFAULT_SETTINGS = {
  hooks: {
    Stop: [
      {
        command: `node "${RUN_SCRIPT}" "${PERSISTENT_MODE_SCRIPT}"`,
      },
    ],
    PreToolUse: [],
    PostToolUse: [],
  },
}

await mkdir(SRICODE_DIR, { recursive: true })

if (existsSync(SETTINGS_PATH)) {
  console.log(`Settings already exist at ${SETTINGS_PATH} — skipping`)
  console.log("To reset, delete the file and re-run this script.")
} else {
  await writeFile(SETTINGS_PATH, JSON.stringify(DEFAULT_SETTINGS, null, 2))
  console.log(`✓ Created ${SETTINGS_PATH}`)
  console.log("OMC persistent-mode hook is now active.")
}
