import OpenAI from "openai";
import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
} from "openai/resources/chat/completions";

const PRIMARY_MODEL = process.env.OPENAI_PRIMARY_MODEL || "gpt-4o";
const FALLBACK_MODEL = process.env.OPENAI_FALLBACK_MODEL || "gpt-4.1-mini";

type ChatCompletionParams = Omit<ChatCompletionCreateParamsNonStreaming, "model"> & {
  model?: string;
  fallbackModel?: string;
};

function isRetryableOpenAIError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const withStatus = error as { status?: number; code?: string };
  if (typeof withStatus.status === "number") {
    return [408, 409, 429, 500, 502, 503, 504].includes(withStatus.status);
  }

  if (typeof withStatus.code === "string") {
    return [
      "rate_limit_exceeded",
      "server_error",
      "timeout",
      "overloaded",
      "api_error",
    ].includes(withStatus.code);
  }

  return false;
}

export async function createChatCompletionWithFallback(
  openai: OpenAI,
  params: ChatCompletionParams
): Promise<{
  completion: ChatCompletion;
  modelUsed: string;
  usedFallback: boolean;
}> {
  const { model, fallbackModel, ...rest } = params;
  const primaryModel = model || PRIMARY_MODEL;
  const secondaryModel = fallbackModel || FALLBACK_MODEL;

  try {
    const completion = await openai.chat.completions.create({
      ...rest,
      model: primaryModel,
      stream: false,
    });
    return { completion, modelUsed: primaryModel, usedFallback: false };
  } catch (error) {
    if (!isRetryableOpenAIError(error) || primaryModel === secondaryModel) {
      throw error;
    }

    const completion = await openai.chat.completions.create({
      ...rest,
      model: secondaryModel,
      stream: false,
    });
    return { completion, modelUsed: secondaryModel, usedFallback: true };
  }
}

export function buildAIHeaders(options: {
  promptVersion: string;
  modelUsed: string;
  usedFallback: boolean;
  source?: string;
}): Record<string, string> {
  return {
    "x-ai-prompt-version": options.promptVersion,
    "x-ai-model": options.modelUsed,
    "x-ai-fallback": options.usedFallback ? "1" : "0",
    "x-ai-source": options.source || "openai",
  };
}
