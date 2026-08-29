import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../http/asyncHandler.js";
import { publicIdSchema } from "../../http/schemas/publicId.js";
import type { AvailabilityService } from "./AvailabilityService.js";

const querySchema = z.object({
  courtId: publicIdSchema,
  date: z.iso.date(),
});

export function createAvailabilityRouter(service: AvailabilityService): Router {
  const router = Router();
  router.get(
    "/availability",
    asyncHandler(async (request, response) => {
      const query = querySchema.parse(request.query);
      response.json(await service.get(query.courtId, query.date));
    }),
  );
  return router;
}
