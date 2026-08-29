import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../http/asyncHandler.js";
import { publicIdSchema } from "../../http/schemas/publicId.js";
import type { CatalogService } from "./CatalogService.js";

const searchSchema = z
  .object({
    query: z.string().trim().max(120).optional(),
    area: z.string().trim().max(120).optional(),
    cityCode: z.string().trim().max(10).optional(),
    sport: z.string().trim().max(100).optional(),
    facilities: z
      .string()
      .transform((value) =>
        value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.string().max(50)).max(10))
      .optional(),
    date: z.iso.date().optional(),
    time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .optional(),
    minimumPrice: z.coerce.number().int().min(0).optional(),
    maximumPrice: z.coerce.number().int().min(0).optional(),
    indoorOutdoorType: z.enum(["INDOOR", "OUTDOOR", "MIXED"]).optional(),
    paymentMode: z.enum(["FULL", "DP", "PAY_AT_VENUE"]).optional(),
    hasPromo: z.stringbool().optional(),
    minimumRating: z.coerce.number().min(0).max(5).optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    maximumDistanceKm: z.coerce.number().positive().max(100).optional(),
    sort: z
      .enum([
        "RELEVANT",
        "NEAREST",
        "PRICE_LOWEST",
        "RATING_HIGHEST",
        "POPULAR",
        "NEWEST",
      ])
      .default("RELEVANT"),
    cursor: publicIdSchema.optional(),
    limit: z.coerce.number().int().min(1).max(20).default(20),
  })
  .superRefine((value, context) => {
    if (
      value.minimumPrice !== undefined &&
      value.maximumPrice !== undefined &&
      value.minimumPrice > value.maximumPrice
    ) {
      context.addIssue({
        code: "custom",
        path: ["maximumPrice"],
        message: "Harga maksimum harus lebih besar dari harga minimum.",
      });
    }
    const hasLatitude = value.latitude !== undefined;
    const hasLongitude = value.longitude !== undefined;
    if (hasLatitude !== hasLongitude) {
      context.addIssue({
        code: "custom",
        path: ["latitude"],
        message: "Latitude dan longitude harus dikirim bersama.",
      });
    }
    if (value.time && !value.date) {
      context.addIssue({
        code: "custom",
        path: ["date"],
        message: "Tanggal wajib dipilih bersama jam.",
      });
    }
  });

export function createCatalogRouter(service: CatalogService): Router {
  const router = Router();
  router.get(
    "/venues",
    asyncHandler(async (request, response) => {
      const parameters = searchSchema.parse(request.query);
      response.json(
        await service.search({
          ...parameters,
          facilitySlugs: parameters.facilities,
        }),
      );
    }),
  );
  router.get(
    "/venues/:slug",
    asyncHandler(async (request, response) => {
      response.json(await service.getBySlug(z.string().parse(request.params.slug)));
    }),
  );
  return router;
}
