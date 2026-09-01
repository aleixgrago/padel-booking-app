import { CookieJar } from "./cookie-jar";

const BASE_URL = "https://princiesport.miclubonline.net";

const COMMON_HEADERS = {
  "X-Requested-With": "XMLHttpRequest",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

export interface PrinciSportBookingResult {
  success: boolean;
  clubBookingId?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Utilidades de parseo de HTML (Drupal 7 con formularios estándar)
// ---------------------------------------------------------------------------

/** Extrae form_build_id / form_token / form_id de un fragmento de HTML. */
function extractHiddenTokens(html: string) {
  const buildId = html.match(/name="form_build_id"\s+value="([^"]+)"/)?.[1];
  const token = html.match(/name="form_token"\s+value="([^"]+)"/)?.[1];
  const formId = html.match(/name="form_id"\s+value="([^"]+)"/)?.[1];
  return { buildId, token, formId };
}

/** Extrae el valor por defecto (option seleccionada) de un <select name="...">. */
function extractSelectedOption(html: string, selectName: string): string | undefined {
  const selectRegex = new RegExp(
    `<select[^>]*name="${selectName}"[^>]*>([\\s\\S]*?)</select>`
  );
  const selectHtml = html.match(selectRegex)?.[1];
  if (!selectHtml) return undefined;

  const selected = selectHtml.match(/<option value="([^"]+)"\s+selected="selected"/);
  if (selected) return selected[1];

  // Si no hay ninguna marcada como seleccionada, Drupal usa la primera opción
  return selectHtml.match(/<option value="([^"]+)"/)?.[1];
}

/** Extrae el valor de un <input type="hidden" name="..."> */
function extractHiddenValue(html: string, fieldName: string): string | undefined {
  return html.match(new RegExp(`name="${fieldName}"\\s+value="([^"]*)"`))?.[1];
}

/** ¿Está el checkbox "name" marcado como checked por defecto? */
function isCheckboxChecked(html: string, fieldName: string): boolean {
  const inputRegex = new RegExp(`name="${fieldName}"[^>]*value="1"[^>]*checked="checked"`);
  return inputRegex.test(html);
}

// ---------------------------------------------------------------------------
// Paso 1: login
// ---------------------------------------------------------------------------

/**
 * Inicia sesión en PrinciSport. Confirmado con .har real:
 *  - El formulario de login es un bloque en la portada ("/"), form_id
 *    "user_login_block", con solo form_build_id (sin form_token).
 *  - Se envía por POST a "/node?destination=node".
 *  - Devuelve 302; la sesión queda en la cookie que absorbe el CookieJar.
 */
async function login(jar: CookieJar, clubUsername: string, clubPassword: string): Promise<void> {
  const homeRes = await fetch(`${BASE_URL}/`, { headers: COMMON_HEADERS });
  jar.absorb(homeRes);
  const homeHtml = await homeRes.text();

  // El form_build_id del login está dentro del bloque "user-login-form"
  const loginBlockHtml = homeHtml.match(
    /id="user-login-form"[\s\S]*?<\/form>/
  )?.[0];
  if (!loginBlockHtml) {
    throw new Error(
      "No se ha encontrado el formulario de login en la portada de PrinciSport (¿ha cambiado la web?)."
    );
  }

  const buildId = loginBlockHtml.match(/name="form_build_id"\s+value="([^"]+)"/)?.[1];
  if (!buildId) {
    throw new Error("No se ha podido extraer form_build_id del formulario de login.");
  }

  const body = new URLSearchParams({
    name: clubUsername,
    pass: clubPassword,
    form_build_id: buildId,
    form_id: "user_login_block",
    op: "Entra",
  });

  const loginRes = await fetch(`${BASE_URL}/node?destination=node`, {
    method: "POST",
    headers: {
      ...COMMON_HEADERS,
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: BASE_URL,
      Referer: `${BASE_URL}/`,
      Cookie: jar.header(),
    },
    body: body.toString(),
    redirect: "manual",
  });
  jar.absorb(loginRes);

  // Login incorrecto: PrinciSport no redirige (devuelve 200 con el mismo
  // formulario y un mensaje de error) en vez de los 302 de un login correcto.
  if (loginRes.status !== 302) {
    throw new Error(
      "El login en PrinciSport no ha redirigido como se esperaba: revisa el código de usuario y la contraseña."
    );
  }
}

// ---------------------------------------------------------------------------
// Paso 2: graella de pistas de un día y selección de franja
// ---------------------------------------------------------------------------

/** Pide la graella HTML de un deporte/fecha. POST sin body, confirmado con .har. */
async function fetchCourtGrid(jar: CookieJar, sportCode: string, dateYYYYMMDD: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/ajax/infopistas/${sportCode}/${dateYYYYMMDD}?language=ca`, {
    method: "POST",
    headers: {
      ...COMMON_HEADERS,
      Origin: BASE_URL,
      Referer: `${BASE_URL}/node`,
      Cookie: jar.header(),
    },
  });
  jar.absorb(res);
  return res.text();
}

interface GridRow {
  row: string;
  selectName: string;
  buttonName: string;
}

/** Extrae todas las filas de la graella: nº de fila, nombre del <select> y del botón. */
function parseGridRows(html: string, sportCode: string, dateYYYYMMDD: string): GridRow[] {
  const rows: GridRow[] = [];
  const buttonRegex = new RegExp(`name="submit-(\\d+)-${sportCode}-${dateYYYYMMDD}-(\\d{4})"`, "g");
  let match: RegExpExecArray | null;
  while ((match = buttonRegex.exec(html)) !== null) {
    const row = match[1];
    rows.push({
      row,
      selectName: `table${sportCode}[${row}][1]`,
      buttonName: `submit-${row}-${sportCode}-${dateYYYYMMDD}-${match[2]}`,
    });
  }
  return rows;
}

/**
 * Envía la selección de pista + pulsa "Reserva" en la franja deseada.
 * Confirmado con .har: el <form> de la graella hace POST a la misma URL,
 * incluyendo el <select> de TODAS las filas (usamos el mismo valor de
 * pista en todas; solo importa el de la fila cuyo botón pulsamos).
 * Responde 302 con Location apuntando a la página de confirmación.
 */
async function submitSlotSelection(
  jar: CookieJar,
  sportCode: string,
  dateYYYYMMDD: string,
  gridHtml: string,
  targetHourHHmm: string,
  courtOptionValue: string
): Promise<string> {
  const rows = parseGridRows(gridHtml, sportCode, dateYYYYMMDD);
  const hourNoColon = targetHourHHmm.replace(":", "");
  const targetRow = rows.find((r) => r.buttonName.endsWith(`-${hourNoColon}`));

  if (!targetRow) {
    throw new Error(
      `La franja ${targetHourHHmm} no está disponible en la graella de PrinciSport para ese día (ya ocupada, o el club aún no la ha abierto).`
    );
  }

  const { buildId, token } = extractHiddenTokens(gridHtml);
  if (!buildId || !token) {
    throw new Error("No se han podido extraer los tokens del formulario de la graella de pistas.");
  }

  const body = new URLSearchParams();
  for (const r of rows) {
    body.set(r.selectName, courtOptionValue);
  }
  body.set(targetRow.buttonName, "Reserva");
  body.set("form_build_id", buildId);
  body.set("form_token", token);
  body.set("form_id", "gpa_piw_pistas_block_sport_form");

  const res = await fetch(`${BASE_URL}/ajax/infopistas/${sportCode}/${dateYYYYMMDD}?language=ca`, {
    method: "POST",
    headers: {
      ...COMMON_HEADERS,
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: BASE_URL,
      Referer: `${BASE_URL}/infopistas/${sportCode}/${dateYYYYMMDD}`,
      Cookie: jar.header(),
    },
    body: body.toString(),
    redirect: "manual",
  });
  jar.absorb(res);

  const location = res.headers.get("location");
  if (res.status !== 302 || !location) {
    throw new Error(
      "PrinciSport no ha aceptado la selección de la franja horaria (puede que ya esté ocupada)."
    );
  }

  return location; // ej: https://princiesport.miclubonline.net/infopistas/02/20260826/15/2015
}

// ---------------------------------------------------------------------------
// Paso 3: página de confirmación y envío final
// ---------------------------------------------------------------------------

/**
 * Carga la página intermedia de confirmación y envía el formulario final,
 * replicando exactamente los valores por defecto que el club aplica a una
 * reserva individual (partido abierto, mixto, sin invitados extra).
 * Confirmado con .har: responde 302 a "/infopistas/ok/{id}".
 */
async function confirmReservation(
  jar: CookieJar,
  confirmationUrl: string,
  clubUsername: string
): Promise<string> {
  const pageRes = await fetch(confirmationUrl, {
    headers: { ...COMMON_HEADERS, Cookie: jar.header() },
  });
  jar.absorb(pageRes);
  const pageHtml = await pageRes.text();

  const { buildId, token } = extractHiddenTokens(pageHtml);
  if (!buildId || !token) {
    throw new Error("No se han podido extraer los tokens del formulario de confirmación.");
  }

  const total = extractHiddenValue(pageHtml, "total") ?? "0";
  const maxJugadores = extractSelectedOption(pageHtml, "max") ?? "3";
  const tiempo = extractSelectedOption(pageHtml, "tiempo") ?? "";
  const abierta = isCheckboxChecked(pageHtml, "abierta") ? "1" : "0";
  const mixto = isCheckboxChecked(pageHtml, "mixto") ? "1" : "0";
  const privado = extractHiddenValue(pageHtml, "privado") ?? "1";

  const actionPath = pageHtml.match(/<form action="([^"]+)"[^>]*id="gpa-piw-pistas-confirmacion-form"/)?.[1];
  const submitUrl = actionPath ? `${BASE_URL}${actionPath}` : confirmationUrl;

  const body = new URLSearchParams({
    total,
    abierta,
    max: maxJugadores,
    mixto,
    privado,
    add: "",
    "invitation-group": "none",
    part1: `[${clubUsername}] (jo)`,
    part2: "",
    part3: "",
    part4: "",
    tiempo,
    reserva: "Reserva",
    form_build_id: buildId,
    form_token: token,
    form_id: "gpa_piw_pistas_confirmacion_form",
  });

  const confirmRes = await fetch(submitUrl, {
    method: "POST",
    headers: {
      ...COMMON_HEADERS,
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: BASE_URL,
      Referer: confirmationUrl,
      Cookie: jar.header(),
    },
    body: body.toString(),
    redirect: "manual",
  });
  jar.absorb(confirmRes);

  const location = confirmRes.headers.get("location");
  const okMatch = location?.match(/\/infopistas\/ok\/(\d+)/);

  if (confirmRes.status !== 302 || !okMatch) {
    throw new Error(
      "PrinciSport no ha confirmado la reserva en el paso final (puede que falten datos obligatorios o la franja se haya ocupado mientras se procesaba)."
    );
  }

  return okMatch[1]; // el id de la reserva, ej. "75447"
}

// ---------------------------------------------------------------------------
// Punto de entrada público
// ---------------------------------------------------------------------------

export async function reserveCourt(params: {
  clubUsername: string;
  clubPassword: string;
  sportCode: string;
  courtOptionValue: string;
  dateYYYYMMDD: string;
  timeSlotHHmm: string;
}): Promise<PrinciSportBookingResult> {
  const jar = new CookieJar();

  try {
    await login(jar, params.clubUsername, params.clubPassword);

    const gridHtml = await fetchCourtGrid(jar, params.sportCode, params.dateYYYYMMDD);

    const confirmationUrl = await submitSlotSelection(
      jar,
      params.sportCode,
      params.dateYYYYMMDD,
      gridHtml,
      params.timeSlotHHmm,
      params.courtOptionValue
    );

    const clubBookingId = await confirmReservation(jar, confirmationUrl, params.clubUsername);

    return { success: true, clubBookingId };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
