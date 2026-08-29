import { LapanganGoApiClient } from "@lapangango/api-client";

export const apiClient = new LapanganGoApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL || "/api/v1",
});

export const serverStateEnabled = import.meta.env.VITE_SERVER_STATE !== "off";

export const prototypeModeEnabled =
  !serverStateEnabled || import.meta.env.VITE_ENABLE_PROTOTYPE_CONTROLS === "true";
