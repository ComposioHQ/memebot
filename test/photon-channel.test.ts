import { describe, expect, it } from "vitest";
import { onMessage } from "../agent/channels/photon";

type InboundMessage = Parameters<typeof onMessage>[1];

const messageFrom = (author: object) => ({ author }) as InboundMessage;
const ctx = {} as Parameters<typeof onMessage>[0];

describe("photon channel onMessage", () => {
  it("ignores messages from bots", () => {
    expect(onMessage(ctx, messageFrom({ isBot: true }))).toBeNull();
  });

  it("accepts messages from people", () => {
    const result = onMessage(ctx, messageFrom({ isBot: false, userId: "+15551234567", fullName: "Sam" }));
    expect(result?.auth?.subject).toBe("+15551234567");
  });
});
