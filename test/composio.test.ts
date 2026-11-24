import { beforeEach, describe, expect, it, vi } from "vitest";

type BeforeExecute = (context: { toolSlug: string; params: Record<string, unknown> }) => Record<string, unknown>;

const session = vi.hoisted(() => ({ update: vi.fn(), tools: vi.fn() }));
const composio = vi.hoisted(() => ({ create: vi.fn(), options: undefined as unknown }));

vi.mock("@composio/core", () => ({
  Composio: class {
    create = composio.create;
    constructor(options: unknown) {
      composio.options = options;
    }
  },
}));
vi.mock("@composio/experimental/eve", () => ({ EveProvider: class {} }));

import { memeTools } from "../lib/composio";

const tools = {
  MEMELORD_GENERATE_IMAGE_MEMES: { inputSchema: { type: "object", properties: { prompt: {}, include_nsfw: {} } } },
  COMPOSIO_SUBMIT_FEEDBACK: { inputSchema: { type: "object", properties: { feedback: {} } } },
};

let beforeExecute: BeforeExecute;

beforeEach(() => {
  vi.clearAllMocks();
  composio.create.mockResolvedValue(session);
  session.tools.mockImplementation(async (modifiers: { beforeExecute: BeforeExecute }) => {
    beforeExecute = modifiers.beforeExecute;
    return tools;
  });
});

describe("memeTools", () => {
  it("creates an instant session limited to the image meme tools, with feedback on, through the eve provider", async () => {
    await expect(memeTools("imessage:+15551234567")).resolves.toBe(tools);

    expect(composio.options).toEqual({ provider: expect.any(Object) });
    expect(composio.create).toHaveBeenCalledWith("imessage:+15551234567", {
      sessionPreset: "direct_tools",
      toolkits: ["memelord"],
      tools: {
        memelord: ["MEMELORD_GENERATE_IMAGE_MEMES", "MEMELORD_GENERATE_CAPTION_MEME", "MEMELORD_GENERATE_AI_MEME"],
      },
      instant: { toolkits: { enable: ["memelord"] } },
    });
    expect(session.update).toHaveBeenCalledWith({ experimental: { submitFeedback: { enable: true } } });
  });

  it("never allows nsfw memes", async () => {
    await memeTools("imessage:+15551234567");

    const params = { prompt: "x", include_nsfw: true };
    expect(beforeExecute({ toolSlug: "MEMELORD_GENERATE_IMAGE_MEMES", params })).toEqual({
      prompt: "x",
      include_nsfw: false,
    });
    expect(beforeExecute({ toolSlug: "MEMELORD_GENERATE_IMAGE_MEMES", params: { prompt: "x" } })).toEqual({
      prompt: "x",
      include_nsfw: false,
    });
  });

  it("leaves input untouched for tools without an nsfw option", async () => {
    await memeTools("imessage:+15551234567");

    const params = { feedback: "great" };
    expect(beforeExecute({ toolSlug: "COMPOSIO_SUBMIT_FEEDBACK", params })).toBe(params);
  });
});
