/** Sincroniza JWT Nest num cookie HttpOnly do portal para o Route Handler `/bb-api/dicomweb`. */
export async function syncBbDicomProxyCookie(accessToken: string): Promise<boolean> {
  if (typeof window === "undefined" || !accessToken.trim()) return false;
  try {
    const r = await fetch(`${window.location.origin}/api/bb-session`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: accessToken.trim() }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function clearBbDicomProxyCookie(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await fetch(`${window.location.origin}/api/bb-session`, {
      method: "DELETE",
      credentials: "include",
    });
  } catch {
    /* ignore */
  }
}
