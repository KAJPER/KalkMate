// Wspólny helper do wywołań API z panelu.
//
// Dlaczego: nginx przy 413/502/504 zwraca stronę HTML, a `await res.json()` na
// takiej odpowiedzi rzuca "Unexpected token <" — panel pokazywał wtedy
// niezrozumiały błąd albo nic. Tu sprawdzamy status i content-type ZANIM
// spróbujemy parsować JSON, a wynik zawsze ma ten sam kształt.
//
// `any` jako domyślny typ body jest celowy — odpowiedzi API panelu nie mają
// wspólnych typów, a wywołujący i tak czytają pola tolerancyjnie (?.).
/* eslint-disable @typescript-eslint/no-explicit-any */

export type FetchJsonResult<T = any> = {
  /** HTTP 2xx, odpowiedź była JSON-em i body nie zawiera ok:false / success:false */
  ok: boolean;
  /** Kod HTTP; 0 = błąd sieci albo przerwane żądanie */
  status: number;
  /** Sparsowane body (null gdy nie-JSON / błąd sieci) */
  data: T | null;
  /** Pole `error` z body, jeśli serwer je podał */
  error: string | null;
  /** Żądanie przerwane przez AbortController */
  aborted: boolean;
  /** Odpowiedź nie była JSON-em (np. strona błędu nginx) */
  notJson: boolean;
};

export async function fetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<FetchJsonResult<T>> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch (e) {
    const aborted =
      (e as { name?: string } | null)?.name === "AbortError" || !!init?.signal?.aborted;
    return { ok: false, status: 0, data: null, error: null, aborted, notJson: false };
  }

  const ct = res.headers.get("content-type") || "";
  let data: any = null;
  let notJson = false;
  if (ct.includes("application/json")) {
    try {
      data = await res.json();
    } catch {
      notJson = true;
    }
  } else {
    notJson = true;
    // Zużyj body, żeby nie trzymać połączenia — treść (HTML nginx) nas nie interesuje.
    try {
      await res.text();
    } catch {
      /* ignore */
    }
  }

  const aborted = !!init?.signal?.aborted;
  const isObj = data !== null && typeof data === "object";
  const bodyOk = isObj ? data.ok !== false && data.success !== false : !notJson;
  const error = isObj && typeof data.error === "string" && data.error ? data.error : null;

  return {
    ok: res.ok && !notJson && bodyOk && !aborted,
    status: res.status,
    data: data as T | null,
    error,
    aborted,
    notJson,
  };
}

/** Wysyła JSON (POST/PUT/PATCH/DELETE) i zwraca wynik fetchJson. */
export function sendJson<T = any>(
  url: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown,
  init?: RequestInit
): Promise<FetchJsonResult<T>> {
  return fetchJson<T>(url, {
    ...init,
    method,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
