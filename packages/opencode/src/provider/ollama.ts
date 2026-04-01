import { createOpenAICompatible } from "@ai-sdk/openai-compatible"

export const OLLAMA_BASE_URL = process.env.SRICODE_OLLAMA_HOST ?? "http://localhost:11434/v1"

// Ollama ignores the API key but the SDK requires a non-empty value
export const OLLAMA_DUMMY_API_KEY = "ollama"

export const ollamaProvider = createOpenAICompatible({
  name: "ollama",
  baseURL: OLLAMA_BASE_URL,
  apiKey: OLLAMA_DUMMY_API_KEY,
})

export const DEFAULT_MODEL = process.env.SRICODE_MODEL ?? "qwen3.5:14b"
export const DEFAULT_PROVIDER = "ollama"
