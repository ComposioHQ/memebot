import { defineEval } from "eve/evals";
import { memeStubs, memeTool } from "./stubs";

export default defineEval({
  async test(t) {
    const session = await t.session({ stubs: memeStubs });
    const turn = await session.send("roast my friend Jake, he's late to every dinner");
    turn.expectOk();
    turn.maxToolCalls(1);
    turn.calledTool(memeTool, { count: 1, input: { include_nsfw: false } });
    t.judge("The text reply is one or two short sentences and contains no link or URL.");
  },
});
