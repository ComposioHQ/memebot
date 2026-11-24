import { describe, expect, it } from "vitest";
import { memeImageMessage, memeImageUrl } from "../lib/meme-image";

const memeOutput = {
  data: { results: [{ success: true, url: "https://cdn.example/meme.jpg" }] },
  successful: true,
};

describe("memeImageUrl", () => {
  it("returns the image URL of a completed Memelord call", () => {
    const call = { name: "MEMELORD_GENERATE_IMAGE_MEMES", outcome: "completed", output: memeOutput };
    expect(memeImageUrl(call)).toBe("https://cdn.example/meme.jpg");
  });

  it("skips results that did not generate", () => {
    const output = {
      data: {
        results: [
          { success: false, url: "https://cdn.example/broken.jpg" },
          { success: true, url: "https://cdn.example/ok.jpg" },
        ],
      },
    };
    expect(memeImageUrl({ name: "MEMELORD_GENERATE_CAPTION_MEME", outcome: "completed", output })).toBe(
      "https://cdn.example/ok.jpg",
    );
  });

  it("ignores failed Memelord calls", () => {
    expect(memeImageUrl({ name: "MEMELORD_GENERATE_IMAGE_MEMES", outcome: "failed", output: memeOutput })).toBeUndefined();
  });

  it("ignores calls to other tools", () => {
    expect(memeImageUrl({ name: "COMPOSIO_SUBMIT_FEEDBACK", outcome: "completed", output: memeOutput })).toBeUndefined();
  });

  it("ignores outputs without results", () => {
    expect(memeImageUrl({ name: "MEMELORD_GET_ACCOUNT", outcome: "completed", output: { data: {} } })).toBeUndefined();
    expect(memeImageUrl({ name: "MEMELORD_GET_ACCOUNT", outcome: "completed" })).toBeUndefined();
    expect(memeImageUrl(undefined)).toBeUndefined();
  });
});

describe("memeImageMessage", () => {
  it("is a valid chat message: an empty text part plus the image file", () => {
    const file = { data: Buffer.from("img"), filename: "meme.webp", mimeType: "image/webp" };
    // The chat SDK rejects a message with no raw/markdown/ast/card part ("Invalid PostableMessage format"),
    // and the iMessage adapter skips empty text, so only the image is sent.
    expect(memeImageMessage(file)).toEqual({ raw: "", files: [file] });
  });
});
