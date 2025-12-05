import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Table } from "../components/Table";
import { Button } from "../components/Button";
import { StatusBadge } from "../components/StatusBadge";

type Vehicle = {
  id: number;
  license_plate: string;
  brand: string;
  model: string;
  year: number;
  max_passengers: number;
  status: string;
  municipality: number;
};

export const VehiclesPage = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<Vehicle>>({ status: "AVAILABLE" });

  const load = () => {
    setLoading(true);
    api.get<Vehicle[]>("/vehicles/").then((res) => setVehicles(res.data)).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post("/vehicles/", form);
    setForm({ status: "AVAILABLE" });
    load();
  };

  return (
    <div className="grid" style={{ gridTemplateColumns: "2fr 1fr" }}>
      <div>
        <h2>Veículos</h2>
        {loading ? (
          <p>Carregando...</p>
        ) : (
          <Table
            columns={[
              { key: "license_plate", label: "Placa" },
              { key: "brand", label: "Marca" },
              { key: "model", label: "Modelo" },
              { key: "year", label: "Ano" },
              { key: "max_passengers", label: "Cap." },
              { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
            ]}
            data={vehicles}
          />
        )}
      </div>
      <div className="card">
        <h3>Novo veículo</h3>
        <form className="grid" style={{ gap: "0.6rem" }} onSubmit={handleSubmit}>
          <input placeholder="Placa" required value={form.license_plate ?? ""} onChange={(e) => setForm((f) => ({ ...f, license_plate: e.target.value }))} />
          <input placeholder="Marca" required value={form.brand ?? ""} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} />
          <input placeholder="Modelo" required value={form.model ?? ""} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} />
          <input placeholder="Ano" type="number" required value={form.year ?? ""} onChange={(e) => setForm((f) => ({ ...f, year: Number(e.target.value) }))} />
          <input placeholder="Capacidade" type="number" required value={form.max_passengers ?? ""} onChange={(e) => setForm((f) => ({ ...f, max_passengers: Number(e.target.value) }))} />
          <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
            <option value="AVAILABLE">Disponível</option>
            <option value="IN_USE">Em uso</option>
            <option value="MAINTENANCE">Manutenção</option>
            <option value="INACTIVE">Inativo</option>
          </select>
          <Button type="submit">Salvar</Button>
        </form>
      </div>
    </div>
  );
};
