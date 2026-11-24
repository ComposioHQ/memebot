import { defineDynamic } from "eve/tools";
import { memeTools } from "../../lib/composio";

// Module-level, so each warm instance keeps one Composio session per sender; Photon's user cap bounds it.
const toolsBySender = new Map<string, ReturnType<typeof memeTools>>();

export default defineDynamic(async (ctx) => {
  const sender = ctx.session.auth.current?.subject;
  if (!sender) return null;

  let tools = toolsBySender.get(sender);
  if (!tools) {
    tools = memeTools(`imessage:${sender}`);
    toolsBySender.set(sender, tools);
  }
  try {
    return await tools;
  } catch (error) {
    // Without tools the model can still reply that it can't make memes right now.
    console.error("Could not load the Composio tools", error);
    toolsBySender.delete(sender);
    return null;
  }
});
