import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { api, driverPortalApi } from "../lib/api";
import { Table } from "../components/Table";
import { Button } from "../components/Button";
import "../styles/login.css";

const modalOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(12,17,24,0.78)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "1.5rem",
  zIndex: 50,
};

const modalContentStyle: CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "16px",
  maxWidth: "820px",
  width: "100%",
  maxHeight: "80vh",
  overflow: "auto",
  boxShadow: "0 24px 48px rgba(0,0,0,0.35)",
  padding: "1rem",
};

type TripPortal = {
  id: number;
  origin: string;
  destination: string;
  status: string;
  category: string;
  departure_datetime: string;
  return_datetime_expected: string;
  passengers_count: number;
  passengers_details?: { name: string; cpf?: string; age?: number | null; special_need?: string; special_need_other?: string; observation?: string }[];
  cargo_description?: string;
  cargo_size?: string;
  cargo_quantity?: number;
  cargo_purpose?: string;
  vehicle_id: number;
  vehicle__license_plate: string;
};

type FuelLogPortal = {
  id: number;
  filled_at: string;
  liters: string;
  fuel_station: string;
  fuel_station_ref_id?: number | null;
  notes?: string;
  receipt_image?: string;
  vehicle__license_plate: string;
};

type FuelStation = { id: number; name: string; address?: string };

export const DriverPortalPage = () => {
  const [code, setCode] = useState("");
  const [token, setToken] = useState<string | null>(localStorage.getItem("driver_portal_token"));
  const [driverName, setDriverName] = useState<string>("");
  const [trips, setTrips] = useState<TripPortal[]>([]);
  const [fuelLogs, setFuelLogs] = useState<FuelLogPortal[]>([]);
  const [stations, setStations] = useState<FuelStation[]>([]);
  const [fuelForm, setFuelForm] = useState<{ vehicle: number | ""; fuel_station_id: number | ""; filled_at: string; liters: string; notes: string; receipt_image: File | null }>({
    vehicle: "",
    fuel_station_id: "",
    filled_at: "",
    liters: "",
    notes: "",
    receipt_image: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showPassengersModal, setShowPassengersModal] = useState(false);
  const [incidentTrip, setIncidentTrip] = useState<TripPortal | null>(null);
  const [incidentText, setIncidentText] = useState("");
  const [incidentError, setIncidentError] = useState<string | null>(null);
  const specialNeedLabel = (value?: string) => {
    switch (value) {
      case "TEA":
        return "TEA";
      case "ELDERLY":
        return "Idoso";
      case "PCD":
        return "Pessoa com deficiência";
      case "OTHER":
        return "Outra";
      default:
        return "Nenhuma";
    }
  };

  const statusLabel = (value: string) => {
    switch (value) {
      case "PLANNED":
        return "Planejada";
      case "IN_PROGRESS":
        return "Em andamento";
      case "COMPLETED":
        return "Concluída";
      case "CANCELLED":
        return "Cancelada";
      default:
        return value;
    }
  };

  const availableVehicles = useMemo(() => {
    const uniques = new Map<number, string>();
    trips.forEach((t) => uniques.set(t.vehicle_id, t.vehicle__license_plate));
    return Array.from(uniques.entries()).map(([id, plate]) => ({ id, plate }));
  }, [trips]);

  const sortedTrips = useMemo(() => {
    return [...trips].sort((a, b) => {
      const aTime = new Date(a.departure_datetime).getTime();
      const bTime = new Date(b.departure_datetime).getTime();
      if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;
      return aTime - bTime;
    });
  }, [trips]);

  const passengerTrips = useMemo(
    () => sortedTrips.filter((t) => (t.passengers_details?.length || 0) > 0),
    [sortedTrips]
  );

  useEffect(() => {
    if (token) {
      loadPortalData();
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const normalizedCode = code.trim().toUpperCase();
      const { data } = await api.post("/drivers/portal/login/", { code: normalizedCode });
      localStorage.setItem("driver_portal_token", data.token);
      setToken(data.token);
      setDriverName(data.driver.name);
      setCode(normalizedCode);
      setError(null);
      loadPortalData();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Código inválido.");
    }
  };

  const loadPortalData = async () => {
    try {
      const tripsRes = await driverPortalApi.get<{ driver: string; trips: TripPortal[] }>("/drivers/portal/trips/");
      setDriverName(tripsRes.data.driver);
      setTrips(tripsRes.data.trips);
      const fuelRes = await driverPortalApi.get<{ logs: FuelLogPortal[] }>("/drivers/portal/fuel_logs/");
      setFuelLogs(fuelRes.data.logs);
      const stationsRes = await driverPortalApi.get<{ stations: FuelStation[] }>("/drivers/portal/fuel_stations/");
      setStations(stationsRes.data.stations);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Sessão expirada ou código inválido. Entre novamente.");
      localStorage.removeItem("driver_portal_token");
      setToken(null);
    }
  };

  const handleCompleteTrip = async (tripId: number) => {
    try {
      await driverPortalApi.post(`/drivers/portal/trips/${tripId}/complete/`);
      setInfo("Viagem marcada como concluída.");
      setError(null);
      loadPortalData();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Não foi possível concluir a viagem.");
    }
  };

  const openIncidentModal = (trip: TripPortal) => {
    setIncidentTrip(trip);
    setIncidentText("");
    setIncidentError(null);
    setShowPassengersModal(false);
  };

  const handleSubmitIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentTrip) return;
    if (!incidentText.trim()) {
      setIncidentError("Descreva o ocorrido.");
      return;
    }
    try {
      await driverPortalApi.post(`/drivers/portal/trips/${incidentTrip.id}/incidents/`, { description: incidentText });
      setInfo("Ocorrência registrada.");
      setIncidentTrip(null);
      setIncidentText("");
      setIncidentError(null);
      loadPortalData();
    } catch (err: any) {
      setIncidentError(err.response?.data?.detail || "Erro ao registrar ocorrência.");
    }
  };

  const handleFuelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fuelForm.vehicle) {
      setError("Escolha o veículo abastecido.");
      return;
    }
    if (!fuelForm.fuel_station_id) {
      setError("Escolha um posto credenciado.");
      return;
    }
    if (!fuelForm.liters || Number(fuelForm.liters) <= 0) {
      setError("Informe a quantidade de litros (maior que zero).");
      return;
    }
    const fd = new FormData();
    fd.append("vehicle", String(fuelForm.vehicle));
    fd.append("fuel_station_id", String(fuelForm.fuel_station_id));
    fd.append("filled_at", fuelForm.filled_at);
    fd.append("liters", fuelForm.liters);
    if (fuelForm.notes) fd.append("notes", fuelForm.notes);
    if (fuelForm.receipt_image) fd.append("receipt_image", fuelForm.receipt_image);
    try {
      await driverPortalApi.post("/drivers/portal/fuel_logs/", fd);
      setFuelForm({ vehicle: fuelForm.vehicle, fuel_station_id: "", filled_at: "", liters: "", notes: "", receipt_image: null });
      setInfo("Abastecimento registrado.");
      loadPortalData();
    } catch (err: any) {
      const data = err.response?.data;
      const firstError =
        data?.detail ||
        (data && typeof data === "object" ? Object.values(data as Record<string, any>).flat().find(Boolean) : null);
      setError(firstError || "Erro ao registrar abastecimento.");
    }
  };

  const logout = () => {
    localStorage.removeItem("driver_portal_token");
    setToken(null);
    setTrips([]);
    setFuelLogs([]);
    setDriverName("");
    setIncidentTrip(null);
  };

  const hasPassengers = passengerTrips.length > 0;

  if (!token) {
    return (
      <div className="login" style={{ minHeight: "100vh" }}>
        <div className="login-card card">
          <h1>Acesso do motorista</h1>
          <p>Informe o código fornecido pela prefeitura para ver suas viagens e prestar contas de abastecimentos.</p>
          <form onSubmit={handleLogin} className="grid form-grid">
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Código do motorista" required />
            <Button type="submit">Entrar</Button>
            {error && <div className="error">{error}</div>}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ margin: "1rem auto", maxWidth: 1200 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <h2>Portal do motorista</h2>
          <p style={{ color: "var(--muted)" }}>Bem-vindo, {driverName || "motorista"}</p>
        </div>
        <Button variant="ghost" onClick={logout}>
          Sair
        </Button>
      </div>
      {error && <div className="card" style={{ color: "#f87171" }}>{error}</div>}
      {info && <div className="card" style={{ color: "#22c55e" }}>{info}</div>}
      <div className="grid" style={{ gridTemplateColumns: "1fr", gap: "1rem" }}>
        <div className="card" style={{ background: "#0f1724", border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.5rem" }}>
            <h3 style={{ margin: 0 }}>Minhas viagens</h3>
            <Button variant="ghost" onClick={() => setShowPassengersModal(true)} disabled={!hasPassengers} title={hasPassengers ? undefined : "Nenhum passageiro cadastrado"}>
              Ver passageiros
            </Button>
          </div>
          <Table
            columns={[
              { key: "origin", label: "Origem" },
              { key: "destination", label: "Destino" },
              { key: "category", label: "Categoria" },
              { key: "status", label: "Status", render: (row) => statusLabel(row.status) },
              { key: "departure_datetime", label: "Saída" },
              { key: "passengers_count", label: "Passageiros" },
              { key: "vehicle__license_plate", label: "Veículo" },
              {
                key: "actions",
                label: "Ações",
                render: (row) => (
                  <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                    <Button
                      variant="ghost"
                      onClick={() => handleCompleteTrip(row.id)}
                      disabled={row.status === "COMPLETED"}
                      title={row.status === "COMPLETED" ? "Viagem já concluída" : "Marcar como concluída"}
                      style={{ padding: "0.4rem 0.6rem" }}
                    >
                      Concluir
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => openIncidentModal(row)}
                      style={{ padding: "0.4rem 0.6rem" }}
                    >
                      Relatar ocorrido
                    </Button>
                  </div>
                ),
              },
            ]}
            data={sortedTrips}
          />
          {!hasPassengers && <p style={{ color: "var(--muted)", marginTop: "0.25rem" }}>Nenhum passageiro cadastrado nas viagens.</p>}
        </div>
        <div className="card" style={{ background: "#0f1724", border: "1px solid var(--border)" }}>
          <h3>Prestação de contas de abastecimento</h3>
          <form className="grid form-grid responsive" onSubmit={handleFuelSubmit}>
            <select value={fuelForm.vehicle} onChange={(e) => setFuelForm((f) => ({ ...f, vehicle: Number(e.target.value) }))} required>
              <option value="">Veículo</option>
              {availableVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate}
                </option>
              ))}
            </select>
            <select
              value={fuelForm.fuel_station_id}
              onChange={(e) => setFuelForm((f) => ({ ...f, fuel_station_id: Number(e.target.value) }))}
              required
            >
              <option value="">Posto credenciado</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <label>
              Data do abastecimento
              <input type="date" value={fuelForm.filled_at} onChange={(e) => setFuelForm((f) => ({ ...f, filled_at: e.target.value }))} required />
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="Litros"
              value={fuelForm.liters}
              onChange={(e) => setFuelForm((f) => ({ ...f, liters: e.target.value }))}
              required
            />
            <textarea placeholder="Observações" value={fuelForm.notes} onChange={(e) => setFuelForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            <label>
              Comprovante (foto)
              <input type="file" accept="image/*" onChange={(e) => setFuelForm((f) => ({ ...f, receipt_image: e.target.files?.[0] || null }))} />
            </label>
            <Button type="submit">Registrar abastecimento</Button>
          </form>
          <Table
            columns={[
              { key: "filled_at", label: "Data" },
              { key: "fuel_station", label: "Posto" },
              { key: "liters", label: "Litros" },
              { key: "vehicle__license_plate", label: "Veículo" },
              {
                key: "receipt_image",
                label: "Nota",
                render: (row) => (row.receipt_image ? <a href={row.receipt_image}>Ver imagem</a> : "—"),
              },
            ]}
            data={fuelLogs}
          />
        </div>
      </div>
      {showPassengersModal && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle} role="dialog" aria-modal="true">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "0.5rem" }}>
              <div>
                <h3 style={{ margin: 0 }}>Passageiros das viagens</h3>
                <p style={{ margin: 0, color: "var(--muted)" }}>Lista organizada pela data e horário de saída.</p>
              </div>
              <Button variant="ghost" onClick={() => setShowPassengersModal(false)}>
                Fechar
              </Button>
            </div>
            {passengerTrips.map((t) => (
              <div
                key={t.id}
                style={{
                  padding: "0.75rem",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  background: "#0b1422",
                  marginBottom: "0.75rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.5rem" }}>
                  <div>
                    <strong>Viagem #{t.id}</strong>
                    <div style={{ color: "var(--muted)", fontSize: "0.95rem" }}>
                      {t.origin} → {t.destination}
                    </div>
                  </div>
                  <div style={{ color: "var(--accent)", fontWeight: 600, fontSize: "0.95rem" }}>
                    {new Date(t.departure_datetime).toLocaleString("pt-BR")}
                  </div>
                </div>
                <ul style={{ margin: 0, paddingLeft: "1rem", display: "grid", gap: "0.4rem" }}>
                  {t.passengers_details?.map((p, idx) => (
                    <li key={`${t.id}-${idx}`} style={{ listStyle: "disc" }}>
                      <div>
                        <strong>{p.name}</strong>
                        {p.age !== undefined && p.age !== null ? ` — ${p.age} anos` : ""}
                      </div>
                      <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
                        Necessidade especial: {p.special_need ? specialNeedLabel(p.special_need) : "Nenhuma"}
                        {p.special_need === "OTHER" && p.special_need_other ? ` (${p.special_need_other})` : ""}
                        {p.observation ? ` — Obs: ${p.observation}` : ""}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
      {incidentTrip && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalContentStyle, maxWidth: "620px" }} role="dialog" aria-modal="true">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "0.5rem" }}>
              <div>
                <h3 style={{ margin: 0 }}>Registrar ocorrência</h3>
                <p style={{ margin: 0, color: "var(--muted)" }}>
                  Viagem #{incidentTrip.id} — {incidentTrip.origin} → {incidentTrip.destination}
                </p>
              </div>
              <Button variant="ghost" onClick={() => setIncidentTrip(null)}>
                Fechar
              </Button>
            </div>
            <form className="grid form-grid" onSubmit={handleSubmitIncident}>
              <textarea
                rows={4}
                placeholder="Descreva o ocorrido..."
                value={incidentText}
                onChange={(e) => {
                  setIncidentText(e.target.value);
                  setIncidentError(null);
                }}
              />
              {incidentError && <div className="error">{incidentError}</div>}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <Button variant="ghost" type="button" onClick={() => setIncidentTrip(null)}>
                  Cancelar
                </Button>
                <Button type="submit">Salvar relato</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
