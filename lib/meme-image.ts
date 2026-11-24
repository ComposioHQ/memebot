type SettledCall = {
  name: string;
  outcome?: string;
  output?: unknown;
};

type MemelordResult = { data?: { results?: { success?: boolean; url?: string }[] } };

/** The meme image URL a finished Memelord call produced, or undefined for any other call. */
export function memeImageUrl(call: SettledCall | undefined): string | undefined {
  if (!call?.name.startsWith("MEMELORD_") || call.outcome !== "completed") return undefined;
  const results = (call.output as MemelordResult | undefined)?.data?.results;
  if (!Array.isArray(results)) return undefined;
  return results.find((result) => result.success !== false && result.url)?.url;
}

const DOWNLOAD_TIMEOUT_MS = 10_000;

type MemeFile = { data: Buffer; filename: string; mimeType: string };

/** Downloads the image now, because Memelord URLs expire. */
export async function downloadMeme(url: string): Promise<MemeFile> {
  const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Meme download failed with status ${response.status}.`);
  const mimeType = response.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
  return {
    data: Buffer.from(await response.arrayBuffer()),
    filename: `meme.${mimeType.split("/")[1] ?? "jpg"}`,
    mimeType,
  };
}

/** A chat message carrying only the image: the empty `raw` text is required by the chat SDK and skipped by iMessage. */
export function memeImageMessage(file: MemeFile) {
  return { raw: "", files: [file] };
}
