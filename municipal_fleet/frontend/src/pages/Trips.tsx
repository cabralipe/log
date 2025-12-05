import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Table } from "../components/Table";
import { Button } from "../components/Button";
import { StatusBadge } from "../components/StatusBadge";

type Vehicle = { id: number; license_plate: string; max_passengers: number };
type Driver = { id: number; name: string };
type Trip = {
  id: number;
  origin: string;
  destination: string;
  departure_datetime: string;
  return_datetime_expected: string;
  status: string;
  vehicle: number;
  driver: number;
  passengers_count: number;
  wa_link?: string;
};

export const TripsPage = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Trip>>({ status: "PLANNED", passengers_count: 0 });

  const load = () => {
    api.get<Trip[]>("/trips/").then((res) => setTrips(res.data));
    api.get<Vehicle[]>("/vehicles/").then((res) => setVehicles(res.data));
    api.get<Driver[]>("/drivers/").then((res) => setDrivers(res.data));
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post("/trips/", form);
    setForm({ status: "PLANNED", passengers_count: 0 });
    load();
  };

  const buildWhatsapp = async (id: number) => {
    const { data } = await api.get<{ message: string; wa_link: string }>(`/trips/${id}/whatsapp_message/`);
    setMessage(data.wa_link);
  };

  return (
    <div className="grid" style={{ gridTemplateColumns: "2fr 1fr" }}>
      <div>
        <h2>Viagens</h2>
        <Table
          columns={[
            { key: "origin", label: "Origem" },
            { key: "destination", label: "Destino" },
            { key: "departure_datetime", label: "Saída" },
            { key: "return_datetime_expected", label: "Retorno" },
            { key: "passengers_count", label: "Passageiros" },
            { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
            {
              key: "id",
              label: "WhatsApp",
              render: (row) => (
                <Button variant="ghost" onClick={() => buildWhatsapp(row.id)}>
                  Gerar link
                </Button>
              ),
            },
          ]}
          data={trips}
        />
        {message && (
          <div className="card" style={{ marginTop: "1rem" }}>
            <strong>Link WhatsApp</strong>
            <p>
              <a href={message} target="_blank" rel="noreferrer">
                {message}
              </a>
            </p>
          </div>
        )}
      </div>
      <div className="card">
        <h3>Nova viagem</h3>
        <form className="grid" style={{ gap: "0.6rem" }} onSubmit={handleSubmit}>
          <input placeholder="Origem" required value={form.origin ?? ""} onChange={(e) => setForm((f) => ({ ...f, origin: e.target.value }))} />
          <input placeholder="Destino" required value={form.destination ?? ""} onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))} />
          <label>
            Saída
            <input type="datetime-local" required value={form.departure_datetime ?? ""} onChange={(e) => setForm((f) => ({ ...f, departure_datetime: e.target.value }))} />
          </label>
          <label>
            Retorno
            <input type="datetime-local" required value={form.return_datetime_expected ?? ""} onChange={(e) => setForm((f) => ({ ...f, return_datetime_expected: e.target.value }))} />
          </label>
          <input placeholder="Passageiros" type="number" value={form.passengers_count ?? 0} onChange={(e) => setForm((f) => ({ ...f, passengers_count: Number(e.target.value) }))} />
          <select value={form.vehicle ?? ""} onChange={(e) => setForm((f) => ({ ...f, vehicle: Number(e.target.value) }))} required>
            <option value="">Veículo</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.license_plate} (cap: {v.max_passengers})
              </option>
            ))}
          </select>
          <select value={form.driver ?? ""} onChange={(e) => setForm((f) => ({ ...f, driver: Number(e.target.value) }))} required>
            <option value="">Motorista</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
            <option value="PLANNED">Planejada</option>
            <option value="IN_PROGRESS">Em andamento</option>
            <option value="COMPLETED">Concluída</option>
            <option value="CANCELLED">Cancelada</option>
          </select>
          <Button type="submit">Salvar</Button>
        </form>
      </div>
    </div>
  );
};
