import { defineEval } from "eve/evals";
import { failingMemeStubs } from "./stubs";

export default defineEval({
  async test(t) {
    const session = await t.session({ stubs: failingMemeStubs });
    const turn = await session.send("make a meme about my cat knocking things off the table");
    turn.expectOk();
    t.judge("The reply is a short apology that the meme could not be made, and invites the user to try again.");
  },
});
