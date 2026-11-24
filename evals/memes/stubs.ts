import type { ToolStub } from "eve/evals";

export const memeTool = "MEMELORD_GENERATE_IMAGE_MEMES";

// Every tool the bot may make a meme with is stubbed, so evals never bill a real meme.
const memeTools = [memeTool, "MEMELORD_GENERATE_CAPTION_MEME", "MEMELORD_GENERATE_AI_MEME"];

export const memeStubs = memeTools.map(
  (tool): ToolStub => ({
    id: tool,
    tool,
    outcome: {
      response: {
        data: { results: [{ success: true, url: "https://example.com/meme.jpg" }] },
        successful: true,
      },
    },
  }),
);

export const failingMemeStubs = memeTools.map(
  (tool): ToolStub => ({ id: tool, tool, outcome: { throw: { message: "Memelord is unavailable" } } }),
);
