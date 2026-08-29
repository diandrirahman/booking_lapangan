import { z } from "zod";

export const publicIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{22}$/, "Referensi resource tidak valid.");
