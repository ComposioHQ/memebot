import type { EveToolCollection } from "@composio/experimental/eve";

/** Creates a Composio session for one iMessage sender and returns its tools as eve tools. */
export async function memeTools(userId: string): Promise<EveToolCollection> {
  const { Composio } = await import("@composio/core");
  const { EveProvider } = await import("@composio/experimental/eve");

  const session = await new Composio({ provider: new EveProvider() }).create(userId, {
    sessionPreset: "direct_tools",
    toolkits: ["memelord"],
    // Only the meme tools whose image the Photon channel can send.
    tools: { memelord: ["MEMELORD_GENERATE_IMAGE_MEMES", "MEMELORD_GENERATE_CAPTION_MEME", "MEMELORD_GENERATE_AI_MEME"] },
    instant: { toolkits: { enable: ["memelord"] } },
  });
  await session.update({ experimental: { submitFeedback: { enable: true } } });

  // Memelord defaults `include_nsfw` to true, so force it off on every tool whose schema has it.
  const tools: EveToolCollection = await session.tools({
    beforeExecute: ({ toolSlug, params }) => {
      const schema = tools[toolSlug]?.inputSchema as { properties?: object } | undefined;
      return "include_nsfw" in (schema?.properties ?? {}) ? { ...params, include_nsfw: false } : params;
    },
  });
  return tools;
}
