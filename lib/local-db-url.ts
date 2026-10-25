export const LOCAL_POSTGRES_PORTS = [5432, 55432] as const;
export const LOCAL_POSTGRES_HOSTS = ["127.0.0.1", "localhost"] as const;

export type LocalDbUrlCheck =
  | { ok: true }
  | { ok: false; reason: "missing" | "invalid" | "cloud" | "not_local_host" | "wrong_port" };

export function checkLocalDbUrl(raw: string | undefined): LocalDbUrlCheck {
  const value = raw?.trim();
  if (!value) return { ok: false, reason: "missing" };

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, reason: "invalid" };
  }

  const host = url.hostname.toLowerCase();
  const port = url.port ? Number(url.port) : 5432;
  if (host.includes("supabase") || host.includes("pooler") || host.includes("amazonaws")) {
    return { ok: false, reason: "cloud" };
  }
  if (!(LOCAL_POSTGRES_HOSTS as readonly string[]).includes(host)) {
    return { ok: false, reason: "not_local_host" };
  }
  if (!(LOCAL_POSTGRES_PORTS as readonly number[]).includes(port)) {
    return { ok: false, reason: "wrong_port" };
  }
  return { ok: true };
}
