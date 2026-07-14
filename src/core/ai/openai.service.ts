import OpenAI from "openai";

let openAIClient: OpenAI | null = null;

function getRequiredEnvironmentVariable(
  name: string
) {
  const value =
    process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `${name} is not configured in the environment.`
    );
  }

  return value;
}

export function getOpenAIClient() {
  if (!openAIClient) {
    openAIClient = new OpenAI({
      apiKey:
        getRequiredEnvironmentVariable(
          "OPENAI_API_KEY"
        ),
    });
  }

  return openAIClient;
}

export function getOpenAIModel() {
  return (
    process.env.OPENAI_MODEL?.trim() ||
    "gpt-5-mini"
  );
}