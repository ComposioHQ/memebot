import { localDev } from "eve/channels/auth";
import { eveChannel } from "eve/channels/eve";

// Evals replace the Memelord tool with stubs, which eve allows only for callers granted
// `allowToolStubs`. `localDev()` admits requests only during local development. Its caller
// has no `subject`, and the meme tools are built per subject, so evals get one.
const authenticate = localDev();

export default eveChannel({
  auth: async (request) => {
    const caller = await authenticate(request);
    return caller ? { ...caller, subject: "eval", allowToolStubs: true } : null;
  },
});
