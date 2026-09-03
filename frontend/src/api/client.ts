const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    // Necesario para que el navegador envíe/reciba la cookie httpOnly de
    // sesión, ya que en producción frontend y backend viven en dominios
    // distintos (Vercel / Render).
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
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

  logout: () => request("/auth/logout", { method: "POST" }),

  getCourts: () => request("/courts"),

  createReservation: (body: { courtId: number; targetDate: string; timeSlot: string }) =>
    request("/reservations", { method: "POST", body: JSON.stringify(body) }),

  bookNow: (body: { courtId: number; targetDate: string; timeSlot: string }) =>
    request("/reservations/book-now", { method: "POST", body: JSON.stringify(body) }),

  listReservations: () => request("/reservations"),

  cancelReservation: (id: string) => request(`/reservations/${id}`, { method: "DELETE" }),

  runNow: () => request("/reservations/run-now", { method: "POST" }),

  // Administración
  listUsers: (status?: string) => request(`/admin/users${status ? `?status=${status}` : ""}`),
  approveUser: (id: string) => request(`/admin/users/${id}/approve`, { method: "POST" }),
  rejectUser: (id: string) => request(`/admin/users/${id}/reject`, { method: "POST" }),
};
