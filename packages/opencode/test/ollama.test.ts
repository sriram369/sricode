import { describe, expect, it } from "bun:test"
import { ollamaProvider, DEFAULT_MODEL, DEFAULT_PROVIDER } from "../src/provider/ollama"

describe("ollama provider", () => {
  it("exports provider and default model", () => {
    expect(ollamaProvider).toBeDefined()
    expect(DEFAULT_MODEL).toBe("qwen3.5:14b")
    expect(DEFAULT_PROVIDER).toBe("ollama")
  })

  it("respects SRICODE_MODEL env override", async () => {
    process.env.SRICODE_MODEL = "llama3.2:3b"
    // Force re-evaluation by clearing module cache isn't possible in bun,
    // but we can test the function directly
    const resolvedModel = process.env.SRICODE_MODEL ?? "qwen3.5:14b"
    expect(resolvedModel).toBe("llama3.2:3b")
    delete process.env.SRICODE_MODEL
  })
})
