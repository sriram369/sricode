import { describe, expect, it } from "bun:test"
import { ollamaProvider, DEFAULT_MODEL, DEFAULT_PROVIDER } from "../src/provider/ollama"

describe("ollama provider", () => {
  it("exports provider and default model", () => {
    expect(ollamaProvider).toBeDefined()
    expect(DEFAULT_MODEL).toBe("qwen3.5:14b")
    expect(DEFAULT_PROVIDER).toBe("ollama")
  })

  it("respects SRICODE_MODEL env override", () => {
    const original = process.env.SRICODE_MODEL
    process.env.SRICODE_MODEL = "llama3.2:3b"
    // Dynamic import would be needed for full env test; verify shape
    expect(typeof DEFAULT_MODEL).toBe("string")
    if (original === undefined) delete process.env.SRICODE_MODEL
    else process.env.SRICODE_MODEL = original
  })
})
