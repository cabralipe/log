import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Table } from "../components/Table";
import { Button } from "../components/Button";
import { StatusBadge } from "../components/StatusBadge";

type Driver = {
  id: number;
  name: string;
  cpf: string;
  phone: string;
  status: string;
};

export const DriversPage = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [form, setForm] = useState<Partial<Driver>>({ status: "ACTIVE" });

  const load = () => {
    api.get<Driver[]>("/drivers/").then((res) => setDrivers(res.data));
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post("/drivers/", form);
    setForm({ status: "ACTIVE" });
    load();
  };

  return (
    <div className="grid" style={{ gridTemplateColumns: "2fr 1fr" }}>
      <div>
        <h2>Motoristas</h2>
        <Table
          columns={[
            { key: "name", label: "Nome" },
            { key: "cpf", label: "CPF" },
            { key: "phone", label: "Telefone" },
            { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
          ]}
          data={drivers}
        />
      </div>
      <div className="card">
        <h3>Novo motorista</h3>
        <form className="grid" style={{ gap: "0.6rem" }} onSubmit={handleSubmit}>
          <input placeholder="Nome" required value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <input placeholder="CPF" required value={form.cpf ?? ""} onChange={(e) => setForm((f) => ({ ...f, cpf: e.target.value }))} />
          <input placeholder="Telefone" required value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
            <option value="ACTIVE">Ativo</option>
            <option value="INACTIVE">Inativo</option>
          </select>
          <Button type="submit">Salvar</Button>
        </form>
      </div>
    </div>
  );
};
