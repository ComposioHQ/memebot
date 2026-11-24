import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { deploy, type DeployIO } from "../src/deploy.js";
import { CommandNotFoundError } from "../src/errors.js";

interface Call {
  tool: string;
  args: string[];
  input?: string;
}

interface Options {
  /** Commands (as `tool args...` prefixes, with the `npx --yes` prefix and version pin stripped) that fail, with their error. */
  failing?: Record<string, Error>;
  /** Tools that are not installed. */
  missing?: string[];
  /** Tools that stay logged out until `<tool> login` runs interactively. */
  loggedOut?: string[];
  teams?: { slug: string; name: string }[];
  repoExists?: boolean;
  acceptLogin?: boolean;
  deployOutput?: string;
  inspectOutput?: string;
  /** The interactive login exits non-zero. */
  loginFails?: boolean;
}

/** Records commands with the `npx --yes` prefix and version pin stripped, so `vercel env add ...` reads as written. */
function fakeIO(answers: Record<string, string>, options: Options = {}) {
  const calls: Call[] = [];
  const asked: string[] = [];
  const logged: string[] = [];
  const steps: string[] = [];
  const selects: string[] = [];
  const loggedOut = new Set(options.loggedOut);
  let deployments = 0;
  const parse = (command: string, args: string[]) => {
    const [pinned, ...rest] = command === "npx" && args[0] === "--yes" ? args.slice(1) : [command, ...args];
    return { tool: pinned.replace(/@\d+$/, ""), rest };
  };
  const io: DeployIO = {
    async run(command, args, runOptions) {
      const { tool, rest } = parse(command, args);
      calls.push({ tool, args: rest, input: runOptions?.input });
      if (options.missing?.includes(command)) throw new CommandNotFoundError(tool);
      const line = `${tool} ${rest.join(" ")}`;
      const failure = Object.entries(options.failing ?? {}).find(([prefix]) => line.startsWith(prefix));
      if (failure) throw failure[1];
      if (loggedOut.has(tool) && (rest[0] === "whoami" || rest[0] === "auth")) throw new Error("not logged in");
      if (tool === "gh" && rest[0] === "api") return "octocat\n";
      if (tool === "gh" && rest[0] === "repo" && rest[1] === "view" && !options.repoExists) throw new Error("not found");
      if (tool === "vercel" && rest[0] === "teams") {
        const json = JSON.stringify({ teams: options.teams ?? [], pagination: { count: 0 } });
        return runOptions?.stdoutOnly ? json : `${json}\n[123ms]\n`;
      }
      if (tool === "vercel" && rest[0] === "deploy") {
        deployments += 1;
        if (options.deployOutput) return options.deployOutput;
        return `https://memebot-${deployments}-abc.vercel.app\nAliased: https://memebot.vercel.app [2s]\n`;
      }
      if (tool === "vercel" && rest[0] === "inspect") return options.inspectOutput ?? "Aliases\n  ╶ https://memebot.vercel.app\n";
      return "";
    },
    async runInteractive(command, args) {
      const { tool, rest } = parse(command, args);
      calls.push({ tool, args: rest });
      if (options.loginFails) throw new Error(`${tool} exited with code 1.`);
      loggedOut.delete(tool);
    },
    async ask(message) {
      asked.push(message);
      const key = Object.keys(answers).find((name) => message.startsWith(name));
      return key ? answers[key] : "";
    },
    async confirm() {
      return options.acceptLogin ?? true;
    },
    async select(message, choices) {
      selects.push(message);
      return choices[1].value;
    },
    async step(title, fn) {
      steps.push(title);
      return fn();
    },
    log: (message) => logged.push(message),
  };
  return { io, calls, asked, logged, steps, selects };
}

const answers = {
  COMPOSIO_API_KEY: "ck_123",
  IMESSAGE_PROJECT_ID: "proj_1",
  IMESSAGE_PROJECT_SECRET: "secret_1",
  IMESSAGE_WEBHOOK_SECRET: "whsec_1",
};

const vercelCalls = (calls: Call[]) => calls.filter((call) => call.tool === "vercel");

describe("missing tools", () => {
  it.each([
    ["gh", "GitHub CLI (`gh`)"],
    ["git", "Git"],
  ])("says how to install %s and to re-run", async (tool, name) => {
    const { io } = fakeIO(answers, { missing: [tool] });
    const message = await deploy(io, "/work").catch((error: Error) => error.message);
    expect(message).toContain(`${name} is not installed`);
    expect(message).toMatch(/brew install|https:\/\//);
    expect(message).toContain("re-run `npx @composio/memebot deploy`");
  });

  it("says npx is missing instead of reporting a login problem", async () => {
    const { io } = fakeIO(answers, { missing: ["npx"] });
    const message = await deploy(io, "/work").catch((error: Error) => error.message);
    expect(message).toContain("npx");
    expect(message).not.toContain("logged in");
  });

  it("says the Vercel CLI could not be fetched instead of reporting a login problem", async () => {
    const { io } = fakeIO(answers, { failing: { "vercel --version": new Error("npm error code ENOTFOUND") } });
    const message = await deploy(io, "/work").catch((error: Error) => error.message);
    expect(message).toContain("Vercel CLI");
    expect(message).toContain("ENOTFOUND");
    expect(message).not.toContain("logged in");
  });
});

describe("login", () => {
  it("offers to log in to Vercel, re-checks, and continues", async () => {
    const { io, calls } = fakeIO(answers, { loggedOut: ["vercel"] });
    await deploy(io, "/work");
    const vercel = vercelCalls(calls).map((call) => call.args[0]);
    expect(vercel.slice(vercel.indexOf("whoami"), vercel.indexOf("whoami") + 3)).toEqual(["whoami", "login", "whoami"]);
  });

  it("names the exact command when the user declines the Vercel login", async () => {
    const { io } = fakeIO(answers, { loggedOut: ["vercel"], acceptLogin: false });
    await expect(deploy(io, "/work")).rejects.toThrow(
      "Run `npx --yes vercel@66 login`, then re-run `npx @composio/memebot deploy`",
    );
  });

  it("gives the command and re-run guidance when the login itself fails", async () => {
    const { io } = fakeIO(answers, { loggedOut: ["vercel"], loginFails: true });
    const message = await deploy(io, "/work").catch((error: Error) => error.message);
    expect(message).toContain("Run it yourself");
    expect(message).toContain("`npx --yes vercel@66 login`");
    expect(message).toContain("re-run `npx @composio/memebot deploy`");
  });

  it("offers to log in to GitHub, then continues", async () => {
    const { io, calls } = fakeIO(answers, { loggedOut: ["gh"] });
    await deploy(io, "/work");
    expect(calls.some((call) => call.tool === "gh" && call.args.join(" ") === "auth login")).toBe(true);
  });

  it("names the exact command when the user declines the GitHub login", async () => {
    const { io } = fakeIO(answers, { loggedOut: ["gh"], acceptLogin: false });
    await expect(deploy(io, "/work")).rejects.toThrow("Run `gh auth login`, then re-run");
  });
});

describe("team scope", () => {
  const teams = [
    { slug: "alpha", name: "Alpha" },
    { slug: "beta", name: "Beta" },
  ];

  it("asks which team to use and scopes every later Vercel command to it", async () => {
    const { io, calls, selects } = fakeIO(answers, { teams });
    await deploy(io, "/work");
    expect(selects).toHaveLength(1);
    const scoped = vercelCalls(calls).filter((call) => ["link", "env", "deploy"].includes(call.args[0]));
    expect(scoped.length).toBeGreaterThan(0);
    for (const call of scoped) expect(call.args.slice(-2)).toEqual(["--scope", "beta"]);
  });

  it("uses the only team without asking", async () => {
    const { io, calls, selects } = fakeIO(answers, { teams: [teams[0]] });
    await deploy(io, "/work");
    expect(selects).toHaveLength(0);
    const link = vercelCalls(calls).find((call) => call.args[0] === "link");
    expect(link?.args.slice(-2)).toEqual(["--scope", "alpha"]);
  });

  it("reads up to 100 teams and survives bracketed noise after the JSON", async () => {
    const { io, calls } = fakeIO(answers, { teams: [teams[0]] });
    await deploy(io, "/work");
    const list = vercelCalls(calls).find((call) => call.args[0] === "teams");
    expect(list?.args).toEqual(["teams", "list", "--json", "--limit", "100"]);
  });

  it("passes no scope for an account without teams", async () => {
    const { io, calls } = fakeIO(answers);
    await deploy(io, "/work");
    expect(vercelCalls(calls).some((call) => call.args.includes("--scope"))).toBe(false);
  });
});

describe("failures", () => {
  it("names the step, shows the stderr tail and a fix, and leaks no secret", async () => {
    const stderr = ["first-line", "l2", "l3", "l4", "l5", "l6", "last-line"].join("\n");
    const { io } = fakeIO(answers, { failing: { "vercel env add": new Error(stderr) } });
    const message = await deploy(io, "/work").catch((error: Error) => error.message);
    expect(message).toContain("Set COMPOSIO_API_KEY on Vercel");
    expect(message).toContain("last-line");
    expect(message).not.toContain("first-line");
    expect(message).toContain("Fix:");
    expect(message).toContain("re-run `npx @composio/memebot deploy`");
    for (const secret of ["ck_123", "secret_1", "whsec_1"]) expect(message).not.toContain(secret);
  });

  it("points a failed deploy at the build logs, not git push", async () => {
    const { io } = fakeIO(answers, { failing: { "vercel deploy": new Error("exited with 1") } });
    const message = await deploy(io, "/work").catch((error: Error) => error.message);
    expect(message).toContain("inspect <deployment-url> --logs");
    expect(message).not.toContain("git push");
  });

  it("explains a missing production domain on its own", async () => {
    const { io } = fakeIO(answers, { deployOutput: "https://memebot-1-abc.vercel.app\n", inspectOutput: "nothing" });
    const message = await deploy(io, "/work").catch((error: Error) => error.message);
    expect(message).toContain("production domain was not found");
    expect(message).toContain("Domains");
    expect(message).not.toContain("--logs");
  });

  it.runIf(process.platform === "darwin")("suggests xcode-select when git exists but fails", async () => {
    const { io } = fakeIO(answers, { failing: { "git --version": new Error("xcode-select: note: no developer tools") } });
    await expect(deploy(io, "/work")).rejects.toThrow("xcode-select --install");
  });

  it("shows a spinner step for the deploy", async () => {
    const { io, steps } = fakeIO(answers);
    await deploy(io, "/work");
    expect(steps).toEqual(expect.arrayContaining(["Create the GitHub repo", "Link the Vercel project", "Deploy to production"]));
  });
});

describe("re-running", () => {
  it("skips repo creation when the repo exists and clones it when the directory is missing", async () => {
    const { io, calls } = fakeIO(answers, { repoExists: true });
    await deploy(io, "/work");
    const gh = calls.filter((call) => call.tool === "gh").map((call) => call.args.slice(0, 2).join(" "));
    expect(gh).not.toContain("repo create");
    expect(gh).toContain("repo clone");
  });

  it("neither creates nor clones when the repo and directory both exist", async () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "memebot-"));
    mkdirSync(path.join(cwd, "memebot"));
    const { io, calls } = fakeIO(answers, { repoExists: true });
    await deploy(io, cwd);
    const gh = calls.filter((call) => call.tool === "gh").map((call) => call.args.slice(0, 2).join(" "));
    expect(gh).not.toContain("repo create");
    expect(gh).not.toContain("repo clone");
  });
});

describe("deploy", () => {
  it("falls back to asking for Photon keys", async () => {
    const { io, calls, asked } = fakeIO(answers);
    await deploy(io, "/work");
    expect(asked).toEqual(expect.arrayContaining(["IMESSAGE_PROJECT_ID", "IMESSAGE_PROJECT_SECRET"]));
    const envSet = calls.filter((call) => call.args[0] === "env").map((call) => [call.args[2], call.input]);
    expect(envSet).toEqual([
      ["COMPOSIO_API_KEY", "ck_123"],
      ["IMESSAGE_PROJECT_ID", "proj_1"],
      ["IMESSAGE_PROJECT_SECRET", "secret_1"],
      ["IMESSAGE_WEBHOOK_SECRET", "whsec_1"],
    ]);
  });

  it("uses the production domain, not the per-deployment url", async () => {
    const { io, logged } = fakeIO(answers);
    await expect(deploy(io, "/work")).resolves.toEqual({ url: "https://memebot.vercel.app" });
    expect(logged.some((line) => line.includes("https://memebot.vercel.app/eve/v1/photon"))).toBe(true);
  });

  it("looks up the production domain when the deploy output has no alias", async () => {
    const { io } = fakeIO(answers, { deployOutput: "https://memebot-1-abc.vercel.app\n" });
    await expect(deploy(io, "/work")).resolves.toEqual({ url: "https://memebot.vercel.app" });
  });

  it("redeploys after the webhook secret is set", async () => {
    const { io, calls } = fakeIO(answers);
    await deploy(io, "/work");
    const steps = calls.map((call) => call.args[0]).filter((step) => step === "env" || step === "deploy");
    expect(steps.at(-2)).toBe("env");
    expect(steps.at(-1)).toBe("deploy");
  });
});
