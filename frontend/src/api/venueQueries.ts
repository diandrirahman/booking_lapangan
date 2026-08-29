import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type {
  Venue as ApiVenue,
  VenuePage as ApiVenuePage,
} from "@lapangango/api-client";
import {
  courts as courtPresentations,
  heroImage,
  venues as venuePresentations,
} from "../data/fixtures";
import type { Court, Venue } from "../domain/types";
import { apiClient, serverStateEnabled } from "./apiClient";

export interface VenueSearchInput {
  query?: string | undefined;
  area?: string | undefined;
  cityCode?: string | undefined;
  sport?: string | undefined;
  facilities?: string | undefined;
  date?: string | undefined;
  time?: string | undefined;
  minimumPrice?: number | undefined;
  maximumPrice?: number | undefined;
  indoorOutdoorType?: "INDOOR" | "OUTDOOR" | "MIXED" | undefined;
  paymentMode?: "FULL" | "DP" | "PAY_AT_VENUE" | undefined;
  hasPromo?: boolean | undefined;
  minimumRating?: number | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  maximumDistanceKm?: number | undefined;
  sort?:
    | "RELEVANT"
    | "NEAREST"
    | "PRICE_LOWEST"
    | "RATING_HIGHEST"
    | "POPULAR"
    | "NEWEST"
    | undefined;
}

interface VenuePresentationPage {
  items: Venue[];
  nextCursor?: string | null;
}

interface VenueDetailPresentation {
  venue: Venue;
  courts: Court[];
  description: string;
  galleryUrls: string[];
  parkingInfo: string | null;
  houseRules: string | null;
  timezone: string;
  addons: Array<{ id: string; name: string; price: number }>;
}

export function useVenueSearch(input: VenueSearchInput = {}) {
  return useQuery<ApiVenuePage, Error, VenuePresentationPage>({
    queryKey: ["venues", input],
    queryFn: () => apiClient.searchVenues({ ...input, limit: 20 }),
    enabled: serverStateEnabled,
    initialData: serverStateEnabled
      ? undefined
      : {
          items: venuePresentations
            .filter((venue) => venue.status === "published")
            .map((venue) => ({
              id: venue.id,
              slug: venue.slug,
              name: venue.name,
              location: venue.location,
              cityCode: null,
              indoorOutdoorType: "INDOOR" as const,
              sport: venue.sport,
              sports: [venue.sport],
              rating: venue.rating,
              reviewCount: venue.reviewCount,
              priceFrom: venue.priceFrom,
              hasPromo: false,
              promoLabel: null,
              nearestSlotStartsAt: null,
              paymentModes: ["FULL" as const],
              distanceKm: null,
              latitude: venue.lat,
              longitude: venue.lng,
              imageUrl: venue.image,
              facilities: venue.facilities,
            })),
          nextCursor: null,
        },
    select: (page) => ({
      ...page,
      items: page.items.map(toVenuePresentation),
    }),
  });
}

export function useInfiniteVenueSearch(input: VenueSearchInput = {}) {
  return useInfiniteQuery<
    ApiVenuePage,
    Error,
    VenuePresentationPage,
    readonly [string, VenueSearchInput],
    string | undefined
  >({
    queryKey: ["venues-infinite", input] as const,
    queryFn: ({ pageParam }) =>
      apiClient.searchVenues({ ...input, cursor: pageParam, limit: 20 }),
    initialPageParam: undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: serverStateEnabled,
    initialData: serverStateEnabled
      ? undefined
      : {
          pages: [createFixtureVenuePage()],
          pageParams: [undefined],
        },
    select: (data) => ({
      items: data.pages.flatMap((page) => page.items.map(toVenuePresentation)),
      nextCursor: data.pages.at(-1)?.nextCursor ?? null,
    }),
  });
}

export function useVenueDetail(slug: string | undefined) {
  return useQuery<ApiVenue, Error, VenueDetailPresentation>({
    queryKey: ["venue", slug],
    queryFn: () => apiClient.getVenue(slug!),
    enabled: Boolean(slug),
    initialData:
      !serverStateEnabled && slug
        ? (() => {
            const venue = venuePresentations.find((item) => item.slug === slug);
            if (!venue) return undefined;
            return {
              id: venue.id,
              slug: venue.slug,
              name: venue.name,
              location: venue.location,
              cityCode: null,
              indoorOutdoorType: "INDOOR" as const,
              sport: venue.sport,
              sports: [venue.sport],
              rating: venue.rating,
              reviewCount: venue.reviewCount,
              priceFrom: venue.priceFrom,
              hasPromo: false,
              promoLabel: null,
              nearestSlotStartsAt: null,
              paymentModes: ["FULL" as const],
              distanceKm: null,
              latitude: venue.lat,
              longitude: venue.lng,
              imageUrl: venue.image,
              facilities: venue.facilities,
              courts: courtPresentations
                .filter((court) => court.venueId === venue.id)
                .map((court) => ({
                  id: court.id,
                  name: court.name,
                  sport: court.sport,
                  surface: court.surface,
                })),
            };
          })()
        : undefined,
    select: (venue) => ({
      venue: toVenuePresentation(venue),
      courts: toCourtPresentations(venue),
      description: venue.description ?? "",
      galleryUrls: venue.galleryUrls ?? [],
      parkingInfo: venue.parkingInfo ?? null,
      houseRules: venue.houseRules ?? null,
      timezone: venue.timezone ?? "Asia/Jakarta",
      addons: venue.addons ?? [],
    }),
  });
}

function toVenuePresentation(venue: ApiVenue): Venue {
  const localPresentation = venuePresentations.find((item) => item.slug === venue.slug);
  if (!serverStateEnabled && localPresentation) return localPresentation;
  return {
    id: venue.id,
    slug: venue.slug,
    tenantId: "api",
    name: venue.name,
    location: venue.location,
    distance:
      venue.distanceKm === null
        ? "Di sekitar lokasimu"
        : `${venue.distanceKm.toLocaleString("id-ID")} km`,
    sport: venue.sport,
    rating: venue.rating,
    reviewCount: venue.reviewCount,
    priceFrom: venue.priceFrom,
    nextSlot: venue.nearestSlotStartsAt
      ? new Intl.DateTimeFormat("id-ID", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(venue.nearestSlotStartsAt))
      : "Lihat slot terbaru",
    image: venue.imageUrl || localPresentation?.image || heroImage,
    status: "published",
    facilities: venue.facilities ?? [],
    lat: venue.latitude ?? localPresentation?.lat ?? -6.24,
    lng: venue.longitude ?? localPresentation?.lng ?? 106.82,
  };
}

function createFixtureVenuePage(): ApiVenuePage {
  return {
    items: venuePresentations
      .filter((venue) => venue.status === "published")
      .map((venue) => ({
        id: venue.id,
        slug: venue.slug,
        name: venue.name,
        location: venue.location,
        cityCode: null,
        indoorOutdoorType: "INDOOR",
        sport: venue.sport,
        sports: [venue.sport],
        rating: venue.rating,
        reviewCount: venue.reviewCount,
        priceFrom: venue.priceFrom,
        hasPromo: false,
        promoLabel: null,
        nearestSlotStartsAt: null,
        paymentModes: ["FULL"],
        distanceKm: null,
        latitude: venue.lat,
        longitude: venue.lng,
        imageUrl: venue.image,
        facilities: venue.facilities,
      })),
    nextCursor: null,
  };
}

function toCourtPresentations(venue: ApiVenue): Court[] {
  return (venue.courts ?? []).map((court) => ({
    id: court.id,
    venueId: venue.id,
    name: court.name,
    sport: court.sport,
    surface: court.surface ?? "Informasi permukaan tersedia di venue",
    active: true,
  }));
}
