import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { api } from "../lib/api";
import "./LiveTracking.css";

type DriverMapPoint = {
  lat: number;
  lng: number;
  accuracy?: number | null;
  speed?: number | null;
  recorded_at?: string;
};

type DriverMapItem = {
  trip_id: number;
  driver_id: number;
  driver_name: string;
  vehicle_id: number;
  vehicle_plate: string;
  status: string;
  status_label: string;
  last_point?: DriverMapPoint | null;
  history?: DriverMapPoint[];
};

type DriverMeta = {
  tripId: number;
  driverName: string;
  vehiclePlate: string;
  status: string;
  statusLabel: string;
  speed?: number | null;
  accuracy?: number | null;
  recordedAt?: string;
};

const MAX_POINTS = 2000;
const OFFLINE_AFTER_MS = 2 * 60 * 1000;

const statusClassMap: Record<string, string> = {
  IN_ROUTE: "in-route",
  STOPPED: "stopped",
  OFFLINE: "offline",
};

const statusLabelMap: Record<string, string> = {
  IN_ROUTE: "Em rota",
  STOPPED: "Parado",
  OFFLINE: "Offline",
};

const buildWsUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api";
  const baseUrl = apiUrl.replace(/\/api\/?$/, "");
  const wsBase = baseUrl.replace(/^http/, "ws");
  const token = localStorage.getItem("access");
  return token ? `${wsBase}/ws/operations/map/?token=${token}` : `${wsBase}/ws/operations/map/`;
};

const colorForDriver = (driverId: number) => {
  const hue = (driverId * 47) % 360;
  return `hsl(${hue}, 70%, 45%)`;
};

const shortLabel = (name: string, plate: string) => {
  const initial = name.trim()[0]?.toUpperCase() || "?";
  const plateSuffix = plate.replace(/\s+/g, "").slice(-3).toUpperCase();
  return plateSuffix ? `${initial}${plateSuffix}` : initial;
};

const popupHtml = (meta: DriverMeta) => {
  const statusLabel = meta.statusLabel || statusLabelMap[meta.status] || meta.status;
  const speed = meta.speed !== undefined && meta.speed !== null ? `${meta.speed.toFixed(1)} km/h` : "—";
  const accuracy = meta.accuracy !== undefined && meta.accuracy !== null ? `${Math.round(meta.accuracy)} m` : "—";
  const lastUpdate = meta.recordedAt ? new Date(meta.recordedAt).toLocaleString("pt-BR") : "—";
  return `
    <div class="gps-popup">
      <div class="gps-popup__title">${meta.driverName}</div>
      <div class="gps-popup__row"><span>Veículo</span><strong>${meta.vehiclePlate}</strong></div>
      <div class="gps-popup__row"><span>Status</span><strong>${statusLabel}</strong></div>
      <div class="gps-popup__row"><span>Velocidade</span><strong>${speed}</strong></div>
      <div class="gps-popup__row"><span>Precisão</span><strong>${accuracy}</strong></div>
      <div class="gps-popup__row"><span>Última atualização</span><strong>${lastUpdate}</strong></div>
    </div>
  `;
};

export const LiveTrackingPage = () => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  const markersByDriverId = useRef<Map<number, L.Marker>>(new Map());
  const polylinesByDriverId = useRef<Map<number, L.Polyline>>(new Map());
  const lastPointsByDriverId = useRef<Map<number, L.LatLngTuple[]>>(new Map());
  const lastUpdateByDriverId = useRef<Map<number, number>>(new Map());
  const driverMetaById = useRef<Map<number, DriverMeta>>(new Map());
  const socketRef = useRef<WebSocket | null>(null);

  const [loading, setLoading] = useState(true);
  const [wsStatus, setWsStatus] = useState<"conectando" | "online" | "offline">("conectando");

  const ensureMarker = (driverId: number, point: L.LatLngTuple, meta: DriverMeta) => {
    const marker = markersByDriverId.current.get(driverId);
    const className = statusClassMap[meta.status] || "offline";
    const icon = L.divIcon({
      className: "gps-marker-wrapper",
      html: `<div class="gps-marker ${className}"><span>${shortLabel(meta.driverName, meta.vehiclePlate)}</span></div>`,
    });
    if (marker) {
      marker.setLatLng(point);
      marker.setIcon(icon);
      marker.setPopupContent(popupHtml(meta));
      return;
    }
    const newMarker = L.marker(point, { icon }).addTo(mapRef.current!);
    newMarker.bindPopup(popupHtml(meta), { className: "gps-popup-wrapper" });
    markersByDriverId.current.set(driverId, newMarker);
  };

  const ensurePolyline = (driverId: number, points: L.LatLngTuple[]) => {
    const existing = polylinesByDriverId.current.get(driverId);
    if (existing) {
      existing.setLatLngs(points);
      return;
    }
    const color = colorForDriver(driverId);
    const polyline = L.polyline(points, { color, weight: 3, opacity: 0.75 }).addTo(mapRef.current!);
    polylinesByDriverId.current.set(driverId, polyline);
  };

  const upsertDriverPoint = (driverId: number, point: DriverMapPoint, meta: DriverMeta) => {
    if (!mapRef.current) return;
    const latlng: L.LatLngTuple = [point.lat, point.lng];
    const points = lastPointsByDriverId.current.get(driverId) ?? [];
    const lastPoint = points[points.length - 1];
    if (!lastPoint || lastPoint[0] !== latlng[0] || lastPoint[1] !== latlng[1]) {
      points.push(latlng);
    }
    if (points.length > MAX_POINTS) {
      points.splice(0, points.length - MAX_POINTS);
    }
    lastPointsByDriverId.current.set(driverId, points);
    ensurePolyline(driverId, points);
    ensureMarker(driverId, latlng, meta);
    if (point.recorded_at) {
      lastUpdateByDriverId.current.set(driverId, new Date(point.recorded_at).getTime());
    }
  };

  const applyStatusUpdate = (driverId: number, status: string) => {
    const marker = markersByDriverId.current.get(driverId);
    const meta = driverMetaById.current.get(driverId);
    if (!marker || !meta) return;
    const nextMeta = { ...meta, status, statusLabel: statusLabelMap[status] || meta.statusLabel };
    driverMetaById.current.set(driverId, nextMeta);
    const className = statusClassMap[status] || "offline";
    const icon = L.divIcon({
      className: "gps-marker-wrapper",
      html: `<div class="gps-marker ${className}"><span>${shortLabel(meta.driverName, meta.vehiclePlate)}</span></div>`,
    });
    marker.setIcon(icon);
    marker.setPopupContent(popupHtml(nextMeta));
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, { zoomControl: true }).setView([-23.55, -46.63], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    mapRef.current = map;
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    let isMounted = true;
    setLoading(true);
    api
      .get<{ drivers: DriverMapItem[] }>("/trips/map-state/", {
        params: { history_limit: MAX_POINTS },
      })
      .then((res) => {
        if (!isMounted) return;
        const { drivers } = res.data;
        let bounds: L.LatLngBounds | null = null;
        drivers.forEach((driver) => {
          const history = (driver.history ?? []).map((p) => [p.lat, p.lng] as L.LatLngTuple);
          if (history.length) {
            lastPointsByDriverId.current.set(driver.driver_id, history);
            ensurePolyline(driver.driver_id, history);
          }
          if (driver.last_point) {
            const meta: DriverMeta = {
              tripId: driver.trip_id,
              driverName: driver.driver_name,
              vehiclePlate: driver.vehicle_plate,
              status: driver.status,
              statusLabel: driver.status_label,
              speed: driver.last_point.speed,
              accuracy: driver.last_point.accuracy,
              recordedAt: driver.last_point.recorded_at,
            };
            driverMetaById.current.set(driver.driver_id, meta);
            upsertDriverPoint(driver.driver_id, driver.last_point, meta);
            const latlng = L.latLng(driver.last_point.lat, driver.last_point.lng);
            bounds = bounds ? bounds.extend(latlng) : L.latLngBounds(latlng, latlng);
          }
        });
        if (bounds) {
          mapRef.current!.fitBounds(bounds.pad(0.2));
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const connectSocket = () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      const wsUrl = buildWsUrl();
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;
      setWsStatus("conectando");

      socket.onopen = () => {
        setWsStatus("online");
      };
      socket.onclose = () => {
        setWsStatus("offline");
        setTimeout(connectSocket, 3000);
      };
      socket.onerror = () => {
        setWsStatus("offline");
      };
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.event !== "gps_ping" || !data.payload) return;
          const payload = data.payload;
          if (payload.lat === undefined || payload.lng === undefined) return;
          const meta: DriverMeta = {
            tripId: payload.trip_id,
            driverName: payload.driver_name,
            vehiclePlate: payload.vehicle_plate,
            status: payload.status,
            statusLabel: payload.status_label,
            speed: payload.speed,
            accuracy: payload.accuracy,
            recordedAt: payload.recorded_at,
          };
          driverMetaById.current.set(payload.driver_id, meta);
          upsertDriverPoint(payload.driver_id, payload, meta);
        } catch (err) {
          console.error("Falha ao processar mensagem do WebSocket", err);
        }
      };
    };
    connectSocket();
    return () => {
      socketRef.current?.close();
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      lastUpdateByDriverId.current.forEach((lastUpdate, driverId) => {
        if (now - lastUpdate > OFFLINE_AFTER_MS) {
          applyStatusUpdate(driverId, "OFFLINE");
        }
      });
    }, 15000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="live-tracking">
      <div className="live-tracking__header">
        <div>
          <h2>Rastreamento em tempo real</h2>
          <p className="muted">Acompanhe motoristas ativos com atualizações a cada poucos segundos.</p>
        </div>
        <div className={`ws-pill ws-pill--${wsStatus}`}>
          {wsStatus === "online" ? "Conectado" : wsStatus === "conectando" ? "Conectando..." : "Offline"}
        </div>
      </div>
      <div className="live-tracking__map">
        <div ref={mapContainerRef} className="live-tracking__map-canvas" />
        {loading && <div className="live-tracking__loading">Carregando mapa...</div>}
        <div className="live-tracking__legend">
          <span className="legend-dot in-route" /> Em rota
          <span className="legend-dot stopped" /> Parado
          <span className="legend-dot offline" /> Offline
        </div>
      </div>
    </div>
  );
};
