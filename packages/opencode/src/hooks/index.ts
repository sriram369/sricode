import z from "zod"

export namespace Hooks {
  export const HookEntry = z.object({
    matcher: z.string().optional(), // tool name to match; omit or "*" = match all
    command: z.string(),
  })
  export type HookEntry = z.infer<typeof HookEntry>

  export const Schema = z.object({
    hooks: z
      .object({
        PreToolUse: z.array(HookEntry).default([]),
        PostToolUse: z.array(HookEntry).default([]),
        Stop: z.array(HookEntry).default([]),
      })
      .default({ PreToolUse: [], PostToolUse: [], Stop: [] }),
  })
  export type Schema = z.infer<typeof Schema>

  export interface RunResult {
    output: string
    blocked: boolean
    exitCode: number
  }
}
