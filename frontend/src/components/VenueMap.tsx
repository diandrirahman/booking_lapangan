import { LocateFixed, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Venue } from "../domain/types";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER: [number, number] = [-6.24, 106.82];
const DEFAULT_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export interface VenueMapProps {
  venues: Venue[];
  selectedVenueId?: string | undefined;
  onSelect: (venueId: string) => void;
  fallback: React.ReactNode;
}

export function VenueMap({
  venues,
  selectedVenueId,
  onSelect,
  fallback,
}: VenueMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef<Map<string, import("leaflet").Marker>>(new Map());
  const [failed, setFailed] = useState(false);
  const [retryVersion, setRetryVersion] = useState(0);
  const [mapReadyVersion, setMapReadyVersion] = useState(0);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    const markers = markersRef.current;

    async function initializeMap() {
      if (!containerRef.current || mapRef.current) return;
      try {
        const leaflet = await import("leaflet");
        if (disposed || !containerRef.current) return;
        const map = leaflet.map(containerRef.current, {
          center: DEFAULT_CENTER,
          zoom: 11,
          zoomControl: true,
          attributionControl: true,
        });
        const tileLayer = leaflet.tileLayer(
          import.meta.env.VITE_MAP_TILE_URL || DEFAULT_TILE_URL,
          {
            attribution: OSM_ATTRIBUTION,
            maxZoom: 19,
            updateWhenIdle: true,
            keepBuffer: 1,
          },
        );
        tileLayer.once("tileerror", () => {
          if (disposed) return;
          map.remove();
          mapRef.current = null;
          setFailed(true);
        });
        tileLayer.addTo(map);
        map.on("locationerror", () => {
          setLocationMessage(
            "Lokasi tidak dapat diakses. Pencarian manual tetap dapat digunakan.",
          );
        });
        map.on("locationfound", () => setLocationMessage("Lokasi ditemukan."));
        mapRef.current = map;
        setMapReadyVersion((version) => version + 1);
      } catch {
        if (!disposed) setFailed(true);
      }
    }

    void initializeMap();
    return () => {
      disposed = true;
      markers.forEach((marker) => marker.remove());
      markers.clear();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [retryVersion]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || failed) return;
    let disposed = false;

    void import("leaflet").then((leaflet) => {
      if (disposed || mapRef.current !== map) return;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      const bounds: Array<[number, number]> = [];

      for (const venue of venues) {
        if (!validCoordinates(venue.lat, venue.lng)) continue;
        const selected = selectedVenueId === venue.id;
        const icon = leaflet.divIcon({
          className: "leaflet-venue-marker-shell",
          html: `<span class="leaflet-venue-marker${selected ? " selected" : ""}" aria-hidden="true"></span>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });
        const marker = leaflet
          .marker([venue.lat, venue.lng], {
            icon,
            keyboard: true,
            title: `Pilih ${venue.name}`,
          })
          .addTo(map)
          .on("click", () => onSelect(venue.id));
        marker.on("add", () => {
          const element = marker.getElement();
          if (element) element.setAttribute("aria-label", `Pilih ${venue.name}`);
        });
        markersRef.current.set(venue.id, marker);
        bounds.push([venue.lat, venue.lng]);
      }

      if (selectedVenueId) {
        const selected = venues.find((venue) => venue.id === selectedVenueId);
        if (selected && validCoordinates(selected.lat, selected.lng)) {
          map.panTo([selected.lat, selected.lng], { animate: false });
          return;
        }
      }
      if (bounds.length > 1) {
        map.fitBounds(bounds, {
          animate: false,
          padding: [36, 36],
          maxZoom: 13,
        });
      }
    });
    return () => {
      disposed = true;
    };
  }, [failed, mapReadyVersion, onSelect, selectedVenueId, venues]);

  function retry() {
    mapRef.current?.remove();
    mapRef.current = null;
    setFailed(false);
    setRetryVersion((version) => version + 1);
  }

  function locateUser() {
    setLocationMessage("Mencari lokasi Anda...");
    mapRef.current?.locate({ setView: true, maxZoom: 14, enableHighAccuracy: true });
  }

  if (failed) {
    return (
      <div className="map-fallback-shell">
        {fallback}
        <button className="map-retry-button" type="button" onClick={retry}>
          <RotateCcw /> Coba muat peta lagi
        </button>
      </div>
    );
  }

  return (
    <div className="api-map-shell">
      <div ref={containerRef} className="api-map" aria-label="Peta venue Leaflet" />
      <button className="map-locate-button" type="button" onClick={locateUser}>
        <LocateFixed /> Gunakan lokasi saya
      </button>
      {locationMessage && <div className="map-location-status">{locationMessage}</div>}
    </div>
  );
}

function validCoordinates(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}
