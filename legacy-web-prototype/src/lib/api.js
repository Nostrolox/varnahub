async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || "Request failed");
    error.status = response.status;
    error.retryAfterSeconds = payload.retryAfterSeconds;
    throw error;
  }

  return payload;
}

export const api = {
  getConfig: () => request("/api/config"),
  signIn: () => request("/api/auth/anonymous", { method: "POST" }),
  getSpots: () => request("/api/spots"),
  createDemoSpots: (anchor = {}) =>
    request("/api/demo/spots", {
      method: "POST",
      body: JSON.stringify(anchor),
    }),
  createSpot: (spot) =>
    request("/api/spots", {
      method: "POST",
      body: JSON.stringify(spot),
    }),
};
