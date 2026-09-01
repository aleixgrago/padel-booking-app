const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

async function request(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem("accessToken");

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error ?? "Error de red inesperado");
  }

  return data;
}

export const api = {
  register: (body: {
    email: string;
    name: string;
    password: string;
    clubUsername: string;
    clubPassword: string;
  }) => request("/auth/register", { method: "POST", body: JSON.stringify(body) }),

  login: (body: { email: string; password: string }) =>
    request("/auth/login", { method: "POST", body: JSON.stringify(body) }),

  verify2fa: (body: { tempToken: string; code: string }) =>
    request("/auth/verify-2fa", { method: "POST", body: JSON.stringify(body) }),

  getCourts: () => request("/courts"),

  createReservation: (body: { courtId: number; targetDate: string; timeSlot: string }) =>
    request("/reservations", { method: "POST", body: JSON.stringify(body) }),

  listReservations: () => request("/reservations"),

  cancelReservation: (id: string) => request(`/reservations/${id}`, { method: "DELETE" }),

  runNow: () => request("/reservations/run-now", { method: "POST" }),
};
