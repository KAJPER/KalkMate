/**
 * Furgonetka.pl API integration
 * Uses OAuth2 client_credentials flow to get bearer tokens.
 */

const FURGONETKA_API_URL = process.env.FURGONETKA_API_URL || "https://api.furgonetka.pl";
const CLIENT_ID = process.env.FURGONETKA_CLIENT_ID || "";
const CLIENT_SECRET = process.env.FURGONETKA_CLIENT_SECRET || "";

interface TokenCache {
  token: string;
  expiresAt: number;
}

let _tokenCache: TokenCache | null = null;

export async function getFurgonetkaToken(): Promise<string> {
  const now = Date.now();
  if (_tokenCache && _tokenCache.expiresAt > now + 60_000) {
    return _tokenCache.token;
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("Brak konfiguracji Furgonetka API (FURGONETKA_CLIENT_ID / FURGONETKA_CLIENT_SECRET)");
  }

  const res = await fetch(`${FURGONETKA_API_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Furgonetka auth failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  _tokenCache = {
    token: data.access_token,
    expiresAt: now + (data.expires_in ?? 3600) * 1000,
  };
  return _tokenCache.token;
}

export interface FurgonetkaPackageParams {
  /** Sender data (your pickup address) */
  pickup: {
    name: string;
    company?: string;
    street: string;
    postcode: string;
    city: string;
    country_code?: string;
    email?: string;
    phone?: string;
  };
  /** Receiver data (customer) */
  receiver: {
    name: string;
    company?: string;
    street: string;
    postcode: string;
    city: string;
    country_code?: string;
    email?: string;
    phone?: string;
    /** InPost paczkomat point ID */
    point?: string;
  };
  /** Furgonetka service_id - configured in Furgonetka panel */
  service_id: number;
  /** Package dimensions */
  parcels: Array<{
    weight: number;   // kg
    width?: number;   // cm
    height?: number;  // cm
    depth?: number;   // cm
  }>;
  user_reference_number?: string;
}

export interface FurgonetkaPackageResult {
  package_id: string;
  group_id?: string;
  service?: string;
  state?: string;
}

/**
 * Add a package to Furgonetka cart (state: "waiting")
 */
export async function createFurgonetkaPackage(
  params: FurgonetkaPackageParams
): Promise<FurgonetkaPackageResult> {
  const token = await getFurgonetkaToken();

  const body = {
    service_id: params.service_id,
    pickup: {
      country_code: "PL",
      ...params.pickup,
    },
    receiver: {
      country_code: "PL",
      ...params.receiver,
    },
    parcels: params.parcels,
    type: "package",
    user_reference_number: params.user_reference_number,
  };

  const res = await fetch(`${FURGONETKA_API_URL}/packages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/vnd.furgonetka.v1+json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Furgonetka create package failed (${res.status}): ${err}`);
  }

  return res.json();
}

/**
 * Order shipment (place order) and get tracking number.
 * Uses the queue-based command: PUT /create-package-command/{uuid}
 * then polls GET /create-package-command/{uuid}.
 */
export async function orderFurgonetkaShipment(packageIds: string[]): Promise<{
  uuid: string;
  status: string;
  details?: unknown;
}> {
  const token = await getFurgonetkaToken();
  const uuid = crypto.randomUUID();

  const res = await fetch(`${FURGONETKA_API_URL}/create-package-command/${uuid}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/vnd.furgonetka.v1+json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      packages: packageIds.map((id) => ({ id })),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Furgonetka order shipment failed (${res.status}): ${err}`);
  }

  return { uuid, ...(await res.json()) };
}

/**
 * Poll create-package-command status
 */
export async function getFurgonetkaCommandStatus(uuid: string): Promise<{
  status: string;
  details?: unknown;
  errors?: unknown[];
}> {
  const token = await getFurgonetkaToken();

  const res = await fetch(`${FURGONETKA_API_URL}/create-package-command/${uuid}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Furgonetka command status failed (${res.status}): ${err}`);
  }

  return res.json();
}

/**
 * Request label document generation (async, returns uuid)
 */
export async function requestFurgonetkaDocuments(packageIds: string[]): Promise<string> {
  const token = await getFurgonetkaToken();
  const uuid = crypto.randomUUID();

  const res = await fetch(`${FURGONETKA_API_URL}/documents-command/${uuid}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/vnd.furgonetka.v1+json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      packages: packageIds.map((id) => ({ id })),
      documents_types: ["labels"],
      label: { page_format: "a4" },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Furgonetka request documents failed (${res.status}): ${err}`);
  }

  return uuid;
}

/**
 * Poll documents command and return URL when ready
 */
export async function getFurgonetkaDocumentUrl(
  uuid: string,
  maxWaitMs = 30_000,
  pollIntervalMs = 2_000
): Promise<string> {
  const token = await getFurgonetkaToken();
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    const res = await fetch(`${FURGONETKA_API_URL}/documents-command/${uuid}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Furgonetka document status failed (${res.status}): ${err}`);
    }

    const data = await res.json();

    if (data.status === "done" || data.status === "completed") {
      if (!data.url) throw new Error("Furgonetka: document ready but no URL");
      return data.url;
    }

    if (data.status === "error" || data.status === "failed") {
      throw new Error(`Furgonetka document generation failed: ${JSON.stringify(data.errors)}`);
    }

    // Still processing – wait
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  throw new Error("Furgonetka document generation timed out");
}
