<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/composio-white.svg">
    <img src=".github/assets/composio-black.svg" alt="Composio" height="34">
  </picture>
  &nbsp;&nbsp;&nbsp;&nbsp;
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/photon-white.svg">
    <img src=".github/assets/photon-black.svg" alt="Photon" height="46">
  </picture>
</p>

<h1 align="center">memebot</h1>

<p align="center"><b>Text a bot anything. It texts back a meme.</b><br>
An open source iMessage agent built with <a href="https://composio.dev">Composio</a> and <a href="https://photon.codes">Photon</a>, running on <a href="https://github.com/vercel/eve">Eve</a>.</p>

<p align="center">
  <a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FComposioHQ%2Fmemebot&amp;project-name=memebot&amp;repository-name=memebot&amp;env=COMPOSIO_API_KEY,IMESSAGE_PROJECT_ID,IMESSAGE_PROJECT_SECRET,IMESSAGE_WEBHOOK_SECRET&amp;envDescription=Get%20COMPOSIO_API_KEY%20at%20https%3A%2F%2Fdashboard.composio.dev%2F~%2Fproject%2Fapi-keys%20%28enable%20Instant%20tools%20for%20the%20project%20at%20https%3A%2F%2Fdashboard.composio.dev%2F~%2Fproject%2Fsettings%2Fgeneral%29.%20Create%20a%20free%20project%20at%20https%3A%2F%2Fapp.photon.codes%2F%20for%20IMESSAGE_PROJECT_ID%20and%20IMESSAGE_PROJECT_SECRET.%20Leave%20IMESSAGE_WEBHOOK_SECRET%20as%20a%20placeholder%20for%20now%3B%20after%20the%20first%20deploy%2C%20register%20the%20webhook%20in%20Photon%20and%20set%20the%20real%20value%20%28see%20README%20Setup%29.&amp;envLink=https%3A%2F%2Fgithub.com%2FComposioHQ%2Fmemebot%23setup"><img src="https://vercel.com/button" alt="Deploy with Vercel"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-black" alt="MIT license"></a>
</p>

```text
you      a meme about Mondays
memebot  🖼️  [meme]
you      roast my friend Sam, he's always "five minutes away"
memebot  🖼️  [meme]
```

- **iMessage, no app.** [Photon](https://photon.codes) gives the bot a real iMessage number.
- **Memes as a tool.** [Composio](https://composio.dev) Instant tools run Memelord with no account to connect, in one 25-line file.
- **Serverless.** Runs on Vercel with no database and no always-on machine.

## Quick start

Deploy with the button above, or from your terminal:

```bash
npx @composio/memebot deploy
```

The CLI checks your tools (`git`, `gh`, `npx`), logs you in to Vercel and GitHub, asks which Vercel team to use, creates your repo and deploys. If a step fails, it tells you how to fix it; re-run the same command to pick up where it stopped.

Either way, finish the [setup](#setup) below.

## Setup

1. **Composio key.** Create an API key at [dashboard.composio.dev](https://dashboard.composio.dev/~/project/api-keys), then turn on **Instant tools** in [project settings](https://dashboard.composio.dev/~/project/settings/general).
2. **Photon project.** Create a free project at [app.photon.codes](https://app.photon.codes/) and copy its project id and secret.
3. **Deploy** with `COMPOSIO_API_KEY`, `IMESSAGE_PROJECT_ID` and `IMESSAGE_PROJECT_SECRET`. Use any placeholder for `IMESSAGE_WEBHOOK_SECRET` for now.
4. **Register the webhook** in Photon: `https://<your-project>.vercel.app/eve/v1/photon`. Use your production domain, not a per-deployment URL.
5. **Set the real `IMESSAGE_WEBHOOK_SECRET`** from Photon and redeploy.
6. **Add who can text it.** On Photon's free plan, only numbers listed in the Photon dashboard under **Users** reach the bot. Add your own number first.
7. **Text the bot.** Its number is in the Photon dashboard.

| Variable | Where to get it |
| --- | --- |
| `COMPOSIO_API_KEY` | [Composio dashboard → API keys](https://dashboard.composio.dev/~/project/api-keys) |
| `IMESSAGE_PROJECT_ID` | [Photon dashboard](https://app.photon.codes/) → your project |
| `IMESSAGE_PROJECT_SECRET` | [Photon dashboard](https://app.photon.codes/) → your project |
| `IMESSAGE_WEBHOOK_SECRET` | Photon, after registering the webhook |

No model key is needed: the LLM runs through Vercel AI Gateway.

## How it works

```text
iMessage ──▶ Photon ──signed webhook──▶ Eve agent on Vercel ──▶ Composio Memelord (Instant)
   ▲                                          │
   └──────────── meme image ◀─────────────────┘
```

1. Photon delivers your message to `/eve/v1/photon`; Eve checks the signature and ignores retries.
2. The agent opens a Composio session for the sender (`imessage:<phone>`) with three Memelord image tools preloaded, and calls one.
3. The bot downloads the meme and sends it back in the same thread.

All of the Composio code, using its [Eve provider](https://docs.composio.dev/docs/providers/eve):

```ts
const composio = new Composio({ provider: new EveProvider() });
const session = await composio.create(userId, {
  sessionPreset: "direct_tools", // preload the allowed tools; no search or auth
  toolkits: ["memelord"],
  tools: { memelord: ["MEMELORD_GENERATE_IMAGE_MEMES", "MEMELORD_GENERATE_CAPTION_MEME", "MEMELORD_GENERATE_AI_MEME"] },
  instant: { toolkits: { enable: ["memelord"] } }, // no account or connection needed
});
const tools = await session.tools({ beforeExecute }); // forces include_nsfw off
```

## Project structure

```text
agent/
  agent.ts             model (via Vercel AI Gateway)
  instructions.md      the bot's prompt and safety rules
  channels/photon.ts   iMessage channel; sends the meme image back
  tools/composio.ts    one Composio session per sender
lib/
  composio.ts          the Composio session and tools
  meme-image.ts        finds, downloads and packages the meme image
evals/                 behavior tests against the real agent (Memelord stubbed)
test/                  unit tests
cli/                   `npx @composio/memebot deploy`
```

## Contributing

Contributions are welcome: new meme behaviors, better prompts, more channels, and fixes.

```bash
pnpm install
cp .env.example .env.local   # fill in the four variables
npx eve link                 # AI Gateway access for the model
pnpm dev
```

Photon can't reach localhost, so test changes with the evals instead of texting the bot.

```bash
pnpm test         # unit tests
pnpm typecheck
pnpm eval         # agent evals; needs COMPOSIO_API_KEY and AI Gateway, Memelord is stubbed so nothing is billed
cd cli && pnpm test
```

Before opening a PR, make sure `pnpm test` and `pnpm typecheck` pass. If you change the bot's behavior, add or update an eval. Keep changes small and focused, and open an issue first for anything big.

## Troubleshooting

- **The bot doesn't reply.** Check that your number is under **Users** in Photon, that `IMESSAGE_WEBHOOK_SECRET` matches the webhook, then check the Vercel logs.
- **"Instant accounts are not enabled".** Turn on Instant tools in [Composio project settings](https://dashboard.composio.dev/~/project/settings/general).
- **You got an apology instead of a meme.** Memelord sometimes takes over 60 seconds, past Composio's SDK timeout. Try again.

## Cost and safety

- Every meme is billed to your Composio balance, for every user you add in Photon (up to 10 on the free plan).
- NSFW is always off, enforced in code. The bot won't make memes attacking appearance, race, gender, religion, disability or other sensitive traits, and roasts target what a friend does, never who they are.

## License

[MIT](LICENSE)
