import { useEffect, useMemo, useRef, useState } from "react";
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
  geofence?: DriverGeofence | null;
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

type DriverGeofence = {
  center_lat: number | null;
  center_lng: number | null;
  radius_m: number;
  is_active: boolean;
  alert_active: boolean;
};

type DriverOption = {
  driverId: number;
  driverName: string;
  vehiclePlate: string;
  status: string;
  statusLabel: string;
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
  const accuracy =
    meta.accuracy !== undefined && meta.accuracy !== null
      ? meta.accuracy > 1000
        ? "Sinal fraco"
        : `${Math.round(meta.accuracy)} m`
      : "—";
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
  const allMapRef = useRef<L.Map | null>(null);
  const allMapContainerRef = useRef<HTMLDivElement | null>(null);

  const allMarkersByDriverId = useRef<Map<number, L.Marker>>(new Map());
  const allPolylinesByDriverId = useRef<Map<number, L.Polyline>>(new Map());
  const lastPointsByDriverId = useRef<Map<number, L.LatLngTuple[]>>(new Map());
  const lastUpdateByDriverId = useRef<Map<number, number>>(new Map());
  const driverMetaById = useRef<Map<number, DriverMeta>>(new Map());
  const driverMapContainersRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const driverMapsRef = useRef<
    Map<number, { map: L.Map; marker?: L.Marker; polyline?: L.Polyline; circle?: L.Circle }>
  >(new Map());
  const socketRef = useRef<WebSocket | null>(null);
  const centerPickDriverIdRef = useRef<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [wsStatus, setWsStatus] = useState<"conectando" | "online" | "offline">("conectando");
  const [trackingMode, setTrackingMode] = useState<"all" | "individual">("all");
  const [driverOptions, setDriverOptions] = useState<DriverOption[]>([]);
  const [selectedDriverIds, setSelectedDriverIds] = useState<number[]>([]);
  const [driverFilter, setDriverFilter] = useState("");
  const [geofencesByDriverId, setGeofencesByDriverId] = useState<Record<number, DriverGeofence>>({});
  const [savingGeofenceIds, setSavingGeofenceIds] = useState<number[]>([]);
  const [geofenceErrors, setGeofenceErrors] = useState<Record<number, string>>({});
  const [centerPickDriverId, setCenterPickDriverId] = useState<number | null>(null);

  const buildMarkerIcon = (meta: DriverMeta) => {
    const className = statusClassMap[meta.status] || "offline";
    return L.divIcon({
      className: "gps-marker-wrapper",
      html: `<div class="gps-marker ${className}"><span>${shortLabel(meta.driverName, meta.vehiclePlate)}</span></div>`,
    });
  };

  const updateMarker = (marker: L.Marker, meta: DriverMeta) => {
    marker.setIcon(buildMarkerIcon(meta));
    marker.setPopupContent(popupHtml(meta));
  };

  const ensureAllMapMarker = (driverId: number, point: L.LatLngTuple, meta: DriverMeta) => {
    if (!allMapRef.current) return;
    const marker = allMarkersByDriverId.current.get(driverId);
    if (marker) {
      marker.setLatLng(point);
      updateMarker(marker, meta);
      return;
    }
    const newMarker = L.marker(point, { icon: buildMarkerIcon(meta) }).addTo(allMapRef.current);
    newMarker.bindPopup(popupHtml(meta), { className: "gps-popup-wrapper" });
    allMarkersByDriverId.current.set(driverId, newMarker);
  };

  const ensureAllMapPolyline = (driverId: number, points: L.LatLngTuple[]) => {
    if (!allMapRef.current) return;
    const existing = allPolylinesByDriverId.current.get(driverId);
    if (existing) {
      existing.setLatLngs(points);
      return;
    }
    const color = colorForDriver(driverId);
    const polyline = L.polyline(points, { color, weight: 3, opacity: 0.75 }).addTo(allMapRef.current);
    allPolylinesByDriverId.current.set(driverId, polyline);
  };

  const ensureDriverMapMarker = (driverId: number, point: L.LatLngTuple, meta: DriverMeta) => {
    const entry = driverMapsRef.current.get(driverId);
    if (!entry) return;
    if (entry.marker) {
      entry.marker.setLatLng(point);
      updateMarker(entry.marker, meta);
      return;
    }
    const newMarker = L.marker(point, { icon: buildMarkerIcon(meta) }).addTo(entry.map);
    newMarker.bindPopup(popupHtml(meta), { className: "gps-popup-wrapper" });
    entry.marker = newMarker;
  };

  const ensureDriverMapPolyline = (driverId: number, points: L.LatLngTuple[]) => {
    const entry = driverMapsRef.current.get(driverId);
    if (!entry) return;
    if (entry.polyline) {
      entry.polyline.setLatLngs(points);
      return;
    }
    const color = colorForDriver(driverId);
    const polyline = L.polyline(points, { color, weight: 3, opacity: 0.75 }).addTo(entry.map);
    entry.polyline = polyline;
  };

  const upsertDriverPoint = (driverId: number, point: DriverMapPoint, meta: DriverMeta) => {
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
    ensureAllMapPolyline(driverId, points);
    ensureAllMapMarker(driverId, latlng, meta);
    ensureDriverMapPolyline(driverId, points);
    ensureDriverMapMarker(driverId, latlng, meta);
    if (point.recorded_at) {
      lastUpdateByDriverId.current.set(driverId, new Date(point.recorded_at).getTime());
    }
  };

  const updateGeofenceState = (driverId: number, updates: Partial<DriverGeofence>) => {
    setGeofencesByDriverId((prev) => {
      const current = prev[driverId] ?? {
        center_lat: null,
        center_lng: null,
        radius_m: 500,
        is_active: false,
        alert_active: false,
      };
      return {
        ...prev,
        [driverId]: { ...current, ...updates },
      };
    });
  };

  const applyStatusUpdate = (driverId: number, status: string) => {
    const meta = driverMetaById.current.get(driverId);
    if (!meta) return;
    const nextMeta = { ...meta, status, statusLabel: statusLabelMap[status] || meta.statusLabel };
    driverMetaById.current.set(driverId, nextMeta);
    const marker = allMarkersByDriverId.current.get(driverId);
    if (marker) {
      updateMarker(marker, nextMeta);
    }
    const entry = driverMapsRef.current.get(driverId);
    if (entry?.marker) {
      updateMarker(entry.marker, nextMeta);
    }
  };

  useEffect(() => {
    if (!allMapContainerRef.current || allMapRef.current) return;
    const map = L.map(allMapContainerRef.current, { zoomControl: true }).setView([-23.55, -46.63], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    allMapRef.current = map;
  }, []);

  useEffect(() => {
    if (!allMapRef.current) return;
    let isMounted = true;
    setLoading(true);
    api
      .get<{ drivers: DriverMapItem[] }>("/trips/map-state/", {
        params: { history_limit: MAX_POINTS },
      })
      .then((res) => {
        if (!isMounted) return;
        const { drivers } = res.data;
        const geofenceSeed: Record<number, DriverGeofence> = {};
        setDriverOptions(
          drivers
            .map((driver) => ({
              driverId: driver.driver_id,
              driverName: driver.driver_name,
              vehiclePlate: driver.vehicle_plate,
              status: driver.status,
              statusLabel: driver.status_label,
            }))
            .sort((a, b) => a.driverName.localeCompare(b.driverName, "pt-BR")),
        );
        let bounds: L.LatLngBounds | null = null;
        drivers.forEach((driver) => {
          const metaBase: DriverMeta = {
            tripId: driver.trip_id,
            driverName: driver.driver_name,
            vehiclePlate: driver.vehicle_plate,
            status: driver.status,
            statusLabel: driver.status_label,
          };
          driverMetaById.current.set(driver.driver_id, metaBase);
          const history = (driver.history ?? []).map((p) => [p.lat, p.lng] as L.LatLngTuple);
          if (history.length) {
            lastPointsByDriverId.current.set(driver.driver_id, history);
            ensureAllMapPolyline(driver.driver_id, history);
          }
          if (driver.last_point) {
            const meta: DriverMeta = {
              ...metaBase,
              speed: driver.last_point.speed,
              accuracy: driver.last_point.accuracy,
              recordedAt: driver.last_point.recorded_at,
            };
            driverMetaById.current.set(driver.driver_id, meta);
            upsertDriverPoint(driver.driver_id, driver.last_point, meta);
            const latlng = L.latLng(driver.last_point.lat, driver.last_point.lng);
            bounds = bounds ? bounds.extend(latlng) : L.latLngBounds(latlng, latlng);
          }
          if (driver.geofence) {
            geofenceSeed[driver.driver_id] = {
              center_lat: driver.geofence.center_lat ?? null,
              center_lng: driver.geofence.center_lng ?? null,
              radius_m: driver.geofence.radius_m ?? 500,
              is_active: driver.geofence.is_active ?? false,
              alert_active: driver.geofence.alert_active ?? false,
            };
          }
        });
        if (Object.keys(geofenceSeed).length) {
          setGeofencesByDriverId((prev) => ({ ...prev, ...geofenceSeed }));
        }
        if (bounds) {
          allMapRef.current!.fitBounds(bounds.pad(0.2));
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
          if (payload.geofence) {
            updateGeofenceState(payload.driver_id, {
              center_lat: payload.geofence.center_lat ?? null,
              center_lng: payload.geofence.center_lng ?? null,
              radius_m: payload.geofence.radius_m ?? 500,
              is_active: payload.geofence.is_active ?? false,
              alert_active: payload.geofence.alert_active ?? false,
            });
          } else if (payload.geofence_alert_active !== undefined) {
            setGeofencesByDriverId((prev) => {
              if (!prev[payload.driver_id]) return prev;
              return {
                ...prev,
                [payload.driver_id]: {
                  ...prev[payload.driver_id],
                  alert_active: Boolean(payload.geofence_alert_active),
                },
              };
            });
          }
          setDriverOptions((prev) => {
            const existing = prev.find((item) => item.driverId === payload.driver_id);
            if (existing) {
              if (
                existing.driverName === payload.driver_name &&
                existing.vehiclePlate === payload.vehicle_plate &&
                existing.status === payload.status &&
                existing.statusLabel === payload.status_label
              ) {
                return prev;
              }
              return prev.map((item) =>
                item.driverId === payload.driver_id
                  ? {
                      ...item,
                      driverName: payload.driver_name,
                      vehiclePlate: payload.vehicle_plate,
                      status: payload.status,
                      statusLabel: payload.status_label,
                    }
                  : item,
              );
            }
            const next = [
              ...prev,
              {
                driverId: payload.driver_id,
                driverName: payload.driver_name,
                vehiclePlate: payload.vehicle_plate,
                status: payload.status,
                statusLabel: payload.status_label,
              },
            ];
            next.sort((a, b) => a.driverName.localeCompare(b.driverName, "pt-BR"));
            return next;
          });
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

  useEffect(() => {
    centerPickDriverIdRef.current = centerPickDriverId;
  }, [centerPickDriverId]);

  const filteredDriverOptions = useMemo(() => {
    const query = driverFilter.trim().toLowerCase();
    if (!query) return driverOptions;
    return driverOptions.filter((driver) => {
      const haystack = `${driver.driverName} ${driver.vehiclePlate}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [driverFilter, driverOptions]);

  const activeGeofenceAlerts = useMemo(() => {
    return Object.values(geofencesByDriverId).filter((geofence) => geofence.alert_active).length;
  }, [geofencesByDriverId]);

  const toggleDriverSelection = (driverId: number) => {
    setSelectedDriverIds((prev) => {
      if (prev.includes(driverId)) {
        return prev.filter((id) => id !== driverId);
      }
      if (prev.length >= 3) {
        return prev;
      }
      return [...prev, driverId];
    });
  };

  const saveGeofence = async (driverId: number) => {
    const geofence = geofencesByDriverId[driverId];
    if (!geofence || geofence.center_lat === null || geofence.center_lng === null) {
      setGeofenceErrors((prev) => ({
        ...prev,
        [driverId]: "Defina o centro no mapa antes de salvar.",
      }));
      return;
    }
    setGeofenceErrors((prev) => ({ ...prev, [driverId]: "" }));
    setSavingGeofenceIds((prev) => [...prev, driverId]);
    try {
      const { data } = await api.put<{ geofence: DriverGeofence }>(`/drivers/geofence/${driverId}/`, {
        center_lat: geofence.center_lat,
        center_lng: geofence.center_lng,
        radius_m: geofence.radius_m,
        is_active: geofence.is_active,
      });
      if (data?.geofence) {
        updateGeofenceState(driverId, data.geofence);
      }
    } catch (err: any) {
      setGeofenceErrors((prev) => ({
        ...prev,
        [driverId]: err?.response?.data?.detail || "Erro ao salvar geofence.",
      }));
    } finally {
      setSavingGeofenceIds((prev) => prev.filter((id) => id !== driverId));
    }
  };

  useEffect(() => {
    if (trackingMode !== "individual") {
      driverMapsRef.current.forEach((entry) => entry.map.remove());
      driverMapsRef.current.clear();
      return;
    }

    selectedDriverIds.forEach((driverId) => {
      if (driverMapsRef.current.has(driverId)) return;
      const container = driverMapContainersRef.current.get(driverId);
      if (!container) return;
      const map = L.map(container, { zoomControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);
      const entry = { map } as { map: L.Map; marker?: L.Marker; polyline?: L.Polyline; circle?: L.Circle };
      map.on("click", (event: L.LeafletMouseEvent) => {
        if (centerPickDriverIdRef.current !== driverId) return;
        updateGeofenceState(driverId, {
          center_lat: event.latlng.lat,
          center_lng: event.latlng.lng,
        });
        setCenterPickDriverId(null);
      });
      driverMapsRef.current.set(driverId, entry);

      const points = lastPointsByDriverId.current.get(driverId) ?? [];
      const meta = driverMetaById.current.get(driverId);
      if (points.length && meta) {
        ensureDriverMapPolyline(driverId, points);
        ensureDriverMapMarker(driverId, points[points.length - 1], meta);
        map.fitBounds(L.latLngBounds(points).pad(0.2));
      } else {
        map.setView([-23.55, -46.63], 12);
      }
      window.setTimeout(() => map.invalidateSize(), 0);
    });

    driverMapsRef.current.forEach((entry, driverId) => {
      if (!selectedDriverIds.includes(driverId)) {
        entry.map.remove();
        driverMapsRef.current.delete(driverId);
      }
    });
  }, [selectedDriverIds, trackingMode]);

  useEffect(() => {
    if (trackingMode !== "individual") return;
    setGeofencesByDriverId((prev) => {
      let changed = false;
      const next = { ...prev };
      selectedDriverIds.forEach((driverId) => {
        if (!next[driverId]) {
          next[driverId] = {
            center_lat: null,
            center_lng: null,
            radius_m: 500,
            is_active: false,
            alert_active: false,
          };
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [selectedDriverIds, trackingMode]);

  useEffect(() => {
    if (trackingMode !== "individual") return;
    selectedDriverIds.forEach((driverId) => {
      const entry = driverMapsRef.current.get(driverId);
      const geofence = geofencesByDriverId[driverId];
      if (!entry) return;
      if (!geofence || geofence.center_lat === null || geofence.center_lng === null) {
        if (entry.circle) {
          entry.circle.remove();
          entry.circle = undefined;
        }
        return;
      }
      const color = geofence.alert_active ? "#dc2626" : geofence.is_active ? "#2563eb" : "#94a3b8";
      const fillColor = geofence.alert_active ? "#f87171" : geofence.is_active ? "#60a5fa" : "#cbd5f5";
      if (entry.circle) {
        entry.circle.setLatLng([geofence.center_lat, geofence.center_lng]);
        entry.circle.setRadius(geofence.radius_m);
        entry.circle.setStyle({ color, fillColor, fillOpacity: 0.18 });
      } else {
        entry.circle = L.circle([geofence.center_lat, geofence.center_lng], {
          radius: geofence.radius_m,
          color,
          fillColor,
          fillOpacity: 0.18,
          weight: 2,
        }).addTo(entry.map);
      }
    });
  }, [geofencesByDriverId, selectedDriverIds, trackingMode]);

  useEffect(() => {
    if (trackingMode === "all" && allMapRef.current) {
      window.setTimeout(() => allMapRef.current?.invalidateSize(), 0);
    }
  }, [trackingMode]);

  useEffect(() => {
    if (trackingMode === "all") {
      setCenterPickDriverId(null);
    }
  }, [trackingMode]);

  return (
    <div className="live-tracking">
      <div className="live-tracking__header">
        <div>
          <h2>Rastreamento em tempo real</h2>
          <p className="muted">Acompanhe motoristas ativos com atualizações a cada poucos segundos.</p>
        </div>
        <div className="live-tracking__status">
          {activeGeofenceAlerts > 0 && (
            <div className="live-tracking__alert-banner">
              {activeGeofenceAlerts} alerta{activeGeofenceAlerts > 1 ? "s" : ""} de raio ativo
            </div>
          )}
          <div className={`ws-pill ws-pill--${wsStatus}`}>
            {wsStatus === "online" ? "Conectado" : wsStatus === "conectando" ? "Conectando..." : "Offline"}
          </div>
        </div>
      </div>
      <div className="live-tracking__controls">
        <div className="tracking-mode-toggle">
          <button
            type="button"
            className={`tracking-mode-toggle__button ${trackingMode === "all" ? "is-active" : ""}`}
            onClick={() => setTrackingMode("all")}
          >
            Mapa geral
          </button>
          <button
            type="button"
            className={`tracking-mode-toggle__button ${trackingMode === "individual" ? "is-active" : ""}`}
            onClick={() => setTrackingMode("individual")}
          >
            Mapas individuais
          </button>
        </div>
        {trackingMode === "individual" && (
          <div className="tracking-filter">
            <div className="tracking-filter__header">
              <strong>Filtrar motoristas</strong>
              <span className="tracking-filter__hint">Selecione até 3</span>
            </div>
            <input
              type="text"
              className="tracking-filter__input"
              placeholder="Busque por nome ou placa"
              value={driverFilter}
              onChange={(event) => setDriverFilter(event.target.value)}
            />
            <div className="tracking-filter__list">
              {filteredDriverOptions.length === 0 && <div className="tracking-filter__empty">Nada encontrado.</div>}
              {filteredDriverOptions.map((driver) => {
                const isSelected = selectedDriverIds.includes(driver.driverId);
                const isDisabled = !isSelected && selectedDriverIds.length >= 3;
                return (
                  <label
                    key={driver.driverId}
                    className={`tracking-filter__item ${isSelected ? "is-selected" : ""} ${
                      isDisabled ? "is-disabled" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isDisabled}
                      onChange={() => toggleDriverSelection(driver.driverId)}
                    />
                    <span className="tracking-filter__name">{driver.driverName}</span>
                    <span className="tracking-filter__plate muted">{driver.vehiclePlate}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {trackingMode === "all" ? (
        <div className="live-tracking__map">
          <div ref={allMapContainerRef} className="live-tracking__map-canvas" />
          {loading && <div className="live-tracking__loading">Carregando mapa...</div>}
          <div className="live-tracking__legend">
            <span className="legend-dot in-route" /> Em rota
            <span className="legend-dot stopped" /> Parado
            <span className="legend-dot offline" /> Offline
          </div>
        </div>
      ) : (
        <div className="live-tracking__maps">
          {selectedDriverIds.length === 0 && (
            <div className="live-tracking__empty">Selecione 1 a 3 motoristas para acompanhar.</div>
          )}
          {selectedDriverIds.map((driverId) => {
            const meta = driverMetaById.current.get(driverId);
            const title = meta?.driverName ?? "Motorista";
            const plate = meta?.vehiclePlate ?? "—";
            const statusLabel = meta?.statusLabel ?? meta?.status ?? "Sem status";
            const geofence = geofencesByDriverId[driverId];
            const isSaving = savingGeofenceIds.includes(driverId);
            return (
              <div key={driverId} className="driver-map-card">
                <div className="driver-map-card__header">
                  <div>
                    <strong>{title}</strong>
                    <span className="muted">{plate}</span>
                  </div>
                  <div className="driver-map-card__badges">
                    {geofence?.alert_active && <span className="driver-map-card__alert">Fora do raio</span>}
                    <span className="driver-map-card__status">{statusLabel}</span>
                  </div>
                </div>
                <div className="driver-map-card__controls">
                  <div className="driver-map-card__field">
                    <label>Raio (m)</label>
                    <input
                      type="number"
                      min={50}
                      max={50000}
                      value={geofence?.radius_m ?? 500}
                      onChange={(event) => {
                        const nextValue = Number(event.target.value);
                        if (Number.isFinite(nextValue)) {
                          updateGeofenceState(driverId, { radius_m: nextValue });
                        }
                      }}
                    />
                  </div>
                  <label className="driver-map-card__toggle">
                    <input
                      type="checkbox"
                      checked={geofence?.is_active ?? false}
                      onChange={(event) => updateGeofenceState(driverId, { is_active: event.target.checked })}
                    />
                    Ativar raio
                  </label>
                  <button
                    type="button"
                    className={`driver-map-card__button ${
                      centerPickDriverId === driverId ? "is-active" : ""
                    }`}
                    onClick={() =>
                      setCenterPickDriverId((current) => (current === driverId ? null : driverId))
                    }
                  >
                    {centerPickDriverId === driverId ? "Clique no mapa..." : "Definir centro"}
                  </button>
                  <button
                    type="button"
                    className="driver-map-card__button primary"
                    disabled={
                      isSaving || geofence?.center_lat === null || geofence?.center_lng === null
                    }
                    onClick={() => saveGeofence(driverId)}
                  >
                    {isSaving ? "Salvando..." : "Salvar raio"}
                  </button>
                  {geofence && geofence.center_lat !== null && geofence.center_lng !== null && (
                    <span className="driver-map-card__coords">
                      Centro: {geofence.center_lat.toFixed(5)}, {geofence.center_lng.toFixed(5)}
                    </span>
                  )}
                  {geofenceErrors[driverId] && (
                    <span className="driver-map-card__error">{geofenceErrors[driverId]}</span>
                  )}
                </div>
                <div className="driver-map-card__map">
                  <div
                    ref={(node) => {
                      if (node) {
                        driverMapContainersRef.current.set(driverId, node);
                      } else {
                        driverMapContainersRef.current.delete(driverId);
                      }
                    }}
                    className="driver-map-canvas"
                  />
                  {loading && <div className="driver-map-card__loading">Carregando mapa...</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
