/**
 * Un "pot de cookies" mínim per anar acumulant la sessió de PrinciSport
 * (Drupal) al llarg de diverses peticions fetch, ja que fetch no gestiona
 * cookies entre crides per si sol.
 */
export class CookieJar {
  private cookies: Record<string, string> = {};

  /** Llegeix les capçaleres Set-Cookie d'una resposta i les incorpora al pot. */
  absorb(res: Response) {
    const setCookieHeaders =
      typeof (res.headers as any).getSetCookie === "function"
        ? (res.headers as any).getSetCookie()
        : res.headers.get("set-cookie")
        ? [res.headers.get("set-cookie") as string]
        : [];

    for (const line of setCookieHeaders) {
      const pair = line.split(";")[0];
      const eq = pair.indexOf("=");
      if (eq > -1) {
        const name = pair.slice(0, eq).trim();
        const value = pair.slice(eq + 1).trim();
        this.cookies[name] = value;
      }
    }
  }

  /** Devuelve la cabecera "Cookie" lista para enviar en la siguiente petición. */
  header(): string {
    return Object.entries(this.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }
}
