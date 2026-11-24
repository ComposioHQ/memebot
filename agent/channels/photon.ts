import { call } from "eve/events";
import {
  defaultPhotonAuth,
  photonIMessageChannel,
  type PhotonInboundMessageContext,
  type PhotonInboundResult,
} from "eve/channels/photon";

import { downloadMeme, memeImageMessage, memeImageUrl } from "../../lib/meme-image";

type InboundMessage = Parameters<typeof defaultPhotonAuth>[0];

export function onMessage(
  _ctx: PhotonInboundMessageContext,
  message: InboundMessage,
): PhotonInboundResult {
  if (message.author.isBot) return null;
  return { auth: defaultPhotonAuth(message) };
}

export default photonIMessageChannel({
  async credentials() {
    const projectId = process.env.IMESSAGE_PROJECT_ID;
    const projectSecret = process.env.IMESSAGE_PROJECT_SECRET;
    if (!projectId || !projectSecret) throw new Error("Photon project credentials are required.");
    return { projectId, projectSecret };
  },
  webhookSecret: process.env.IMESSAGE_WEBHOOK_SECRET,
  onMessage,
  events: {
    // Eve replies are text only, so the meme image is posted when its Memelord call settles.
    async "call.settled"(event, ctx) {
      if (!ctx.channel.thread) return;
      try {
        const url = memeImageUrl(call(ctx.view, event.data.callId));
        if (!url) return;
        await ctx.channel.thread.post(memeImageMessage(await downloadMeme(url)));
      } catch (error) {
        console.error("Could not send the meme image", error);
        // Best effort: a failing apology must never throw out of the handler.
        await ctx.channel.thread
          .post({ markdown: "I made a meme but couldn't send it. Try again?" })
          .catch((apologyError: unknown) => console.error("Could not send the apology", apologyError));
      }
    },
  },
});
