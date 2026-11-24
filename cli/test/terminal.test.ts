import { describe, expect, it } from "vitest";
import { CommandNotFoundError } from "../src/errors.js";
import { terminalIO } from "../src/terminal.js";

describe("terminalIO.run", () => {
  it("reports a command that is not installed as CommandNotFoundError", async () => {
    const error = await terminalIO.run("memebot-no-such-command", []).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CommandNotFoundError);
    expect((error as CommandNotFoundError).command).toBe("memebot-no-such-command");
  });

  it("reports a command that exits non-zero with its stderr", async () => {
    const error = await terminalIO.run("node", ["-e", "console.error('bad'); process.exit(1)"]).catch((e: unknown) => e);
    expect(error).not.toBeInstanceOf(CommandNotFoundError);
    expect((error as Error).message).toContain("bad");
  });
});
