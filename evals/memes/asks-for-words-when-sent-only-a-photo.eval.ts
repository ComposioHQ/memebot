import { fileURLToPath } from "node:url";
import { defineEval } from "eve/evals";
import { memeStubs } from "./stubs";

const photo = fileURLToPath(new URL("../fixtures/photo.png", import.meta.url));

export default defineEval({
  async test(t) {
    const session = await t.session({ stubs: memeStubs });
    const turn = await session.sendFile("", photo, "image/png");
    turn.expectOk();
    turn.usedNoTools();
    t.judge("The reply asks the user to describe in words the meme they want.");
  },
});
