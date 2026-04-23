"use client";

import { useEffect, useRef } from "react";
import { Box, Text, useColorModeValue } from "@chakra-ui/react";

interface AgentPin {
  name: string;
  city: string;
  lat: number;
  lng: number;
}

const DEFAULT_AGENTS: AgentPin[] = [
  { name: "Tripoli Central", city: "Tripoli", lat: 32.9, lng: 13.18 },
  { name: "Benghazi Office", city: "Benghazi", lat: 32.12, lng: 20.07 },
  { name: "Misrata Hub", city: "Misrata", lat: 32.38, lng: 15.09 },
  { name: "Sabha Branch", city: "Sabha", lat: 27.04, lng: 14.43 },
  { name: "Zawiya Agent", city: "Zawiya", lat: 32.76, lng: 12.73 },
  { name: "Zliten Point", city: "Zliten", lat: 32.47, lng: 14.57 },
];

export default function AgentMap({ agents }: { agents?: AgentPin[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const isDark = useColorModeValue(false, true);
  const pins = agents?.length ? agents : DEFAULT_AGENTS;

  useEffect(() => {
    if (!mapRef.current || typeof window === "undefined") return;

    const loadMap = async () => {
      const L = (await import("leaflet")).default;

      // Inject Leaflet CSS if not already present
      if (!document.querySelector('link[href*="leaflet"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      if (mapInstance.current) {
        mapInstance.current.remove();
      }

      const map = L.map(mapRef.current!, {
        center: [30.0, 17.0],
        zoom: 6,
        zoomControl: false,
        attributionControl: false,
      });

      const tileUrl = isDark
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

      L.tileLayer(tileUrl, { maxZoom: 18 }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);

      const icon = L.divIcon({
        html: `<div style="
          width:28px;height:28px;border-radius:50%;
          background:#0057b8;border:3px solid #fff;
          box-shadow:0 2px 8px rgba(0,0,0,0.3);
          display:flex;align-items:center;justify-content:center;
          font-size:12px;color:#fff;font-weight:700;
        ">A</div>`,
        className: "",
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      pins.forEach((pin) => {
        L.marker([pin.lat, pin.lng], { icon })
          .addTo(map)
          .bindPopup(
            `<div style="font-family:Inter,sans-serif;font-size:13px">
              <b>${pin.name}</b><br/>${pin.city}
            </div>`
          );
      });

      mapInstance.current = map;
    };

    loadMap();

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [isDark, pins]);

  return (
    <Box
      ref={mapRef}
      w="100%"
      h={{ base: "300px", md: "400px" }}
      borderRadius="xl"
      overflow="hidden"
      border="1px solid"
      borderColor="card-border"
    />
  );
}
