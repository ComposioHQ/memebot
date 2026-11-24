# memebot

**Text the bot anything: a topic, a mood, a friend to roast. It texts back a meme.**

Built on [Eve](https://github.com/vercel/eve) (Vercel's agent framework), [Photon](https://photon.codes) for iMessage, and [Composio](https://composio.dev) Memelord Instant tools for the memes.

## Deploy with Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FComposioHQ%2Fmemebot&project-name=memebot&repository-name=memebot&env=COMPOSIO_API_KEY,IMESSAGE_PROJECT_ID,IMESSAGE_PROJECT_SECRET,IMESSAGE_WEBHOOK_SECRET&envDescription=Get%20COMPOSIO_API_KEY%20at%20https%3A%2F%2Fdashboard.composio.dev%2F~%2Fproject%2Fapi-keys%20%28enable%20Instant%20tools%20for%20the%20project%20at%20https%3A%2F%2Fdashboard.composio.dev%2F~%2Fproject%2Fsettings%2Fgeneral%29.%20Create%20a%20free%20project%20at%20https%3A%2F%2Fapp.photon.codes%2F%20for%20IMESSAGE_PROJECT_ID%20and%20IMESSAGE_PROJECT_SECRET.%20Leave%20IMESSAGE_WEBHOOK_SECRET%20as%20a%20placeholder%20for%20now%3B%20after%20the%20first%20deploy%2C%20register%20the%20webhook%20in%20Photon%20and%20set%20the%20real%20value%20%28see%20README%20Setup%29.&envLink=https%3A%2F%2Fgithub.com%2FComposioHQ%2Fmemebot%23setup)

Then finish the [Setup](#setup) below (the webhook secret only exists after the first deploy).

### Or use the CLI

First finish Setup steps 1 and 2 (a Composio key with Instant tools enabled, and a Photon project), run `gh auth login`, and have a Vercel account. Then:

```bash
npx @composio/memebot deploy
```

## Setup

1. **Composio key.** Get an API key at [dashboard.composio.dev](https://dashboard.composio.dev/~/project/api-keys) and enable **Instant tools** for the project in [project settings](https://dashboard.composio.dev/~/project/settings/general). Without it, meme calls fail with "Instant accounts are not enabled".
2. **Photon project.** Create a free project at [app.photon.codes](https://app.photon.codes/). Copy its project id and secret.
3. **Deploy.** Set `COMPOSIO_API_KEY`, `IMESSAGE_PROJECT_ID` and `IMESSAGE_PROJECT_SECRET`. Put any placeholder in `IMESSAGE_WEBHOOK_SECRET` for now; the bot will not reply until the real secret is set and the project is redeployed.
4. **Register the webhook.** In Photon, add `https://<your-project>.vercel.app/eve/v1/photon` and copy its signing secret. Use your production domain: per-deployment URLs change and sit behind Vercel Deployment Protection.
5. **Redeploy** with the real `IMESSAGE_WEBHOOK_SECRET`.
6. **Add who can text it.** On Photon's free plan, the bot only gets messages from numbers you add in the Photon dashboard under **Users**. Add your own phone number first, plus anyone else you want to let in.
7. **Text the bot.** Its number is shown in the Photon dashboard. Try: "a meme about Mondays", "my cat knocking everything off the table", or "roast my friend Sam, he's always 'five minutes away'".

| Variable | Where to get it |
| --- | --- |
| `COMPOSIO_API_KEY` | Composio dashboard, API keys |
| `IMESSAGE_PROJECT_ID` | Photon dashboard, your project |
| `IMESSAGE_PROJECT_SECRET` | Photon dashboard, your project |
| `IMESSAGE_WEBHOOK_SECRET` | Photon dashboard, after registering the webhook |

If the bot stays silent, first check that your number is listed under **Users** in Photon, then check the Vercel logs: a wrong `COMPOSIO_API_KEY` or Instant tools not enabled shows up there.

Memelord can take over 60s; calls past Composio's 60s SDK timeout get the apology.

The LLM runs through Vercel AI Gateway, so no model key is needed on Vercel.

## How it works

1. Photon receives your iMessage and POSTs a signed webhook to `/eve/v1/photon`.
2. Eve verifies it, dedupes retries, and hands the message to the agent.
3. The agent gets a Composio session for that sender (`imessage:<phone>`) with the three image meme tools (`MEMELORD_GENERATE_IMAGE_MEMES`, `MEMELORD_GENERATE_CAPTION_MEME`, `MEMELORD_GENERATE_AI_MEME`) and the feedback tool preloaded, and calls one to make the meme.
4. The bot downloads the image and replies in the same iMessage thread.

Composio's [eve provider](https://docs.composio.dev/docs/providers/eve) turns the session's tools into eve tools, so that is all the Composio code there is:

```ts
const composio = new Composio({ provider: new EveProvider() });
const session = await composio.create(userId, {
  sessionPreset: "direct_tools", // preload all allowed tools; search, connections, workbench off
  toolkits: ["memelord"],
  tools: { memelord: ["MEMELORD_GENERATE_IMAGE_MEMES", "MEMELORD_GENERATE_CAPTION_MEME", "MEMELORD_GENERATE_AI_MEME"] },
  instant: { toolkits: { enable: ["memelord"] } }, // no account or connection needed
});
await session.update({ experimental: { submitFeedback: { enable: true } } });
const tools = await session.tools({ beforeExecute }); // beforeExecute forces include_nsfw off
```

1:1 iMessage only. If meme generation fails, the bot apologizes instead of going silent.

## Cost

Memelord runs as Instant tools, so **everyone you add under Users in Photon spends your Composio balance**. The Photon free plan allows up to 10 users.

## Tone

Any topic works. No memes attacking appearance, race, gender, religion, disability or other sensitive traits, and roasts target what a friend does, never who they are. NSFW is always off, enforced in code.

## Develop locally

```bash
pnpm install
cp .env.example .env.local   # fill in the four variables
npx eve link                 # AI Gateway access for the model (or `vercel env pull`)
pnpm dev
```

Photon webhooks cannot reach localhost, so test locally through `eve dev` or the evals rather than by texting the bot.

```bash
pnpm test        # unit tests
pnpm typecheck
pnpm eval        # needs COMPOSIO_API_KEY and AI Gateway access
```

Evals open a real Composio session and list its tools, but the Memelord call itself is stubbed, so nothing is billed.
