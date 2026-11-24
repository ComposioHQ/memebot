import { defineEval } from "eve/evals";
import { memeStubs } from "./stubs";

export default defineEval({
  async test(t) {
    const session = await t.session({ stubs: memeStubs });
    const turn = await session.send("hi");
    turn.expectOk();
    turn.usedNoTools();
    t.judge("The reply explains in one line that the user can describe anything to get a meme, with 2-3 example asks.");
  },
});
