import { useState, useEffect } from "react";
import { Button } from "./Button";

type VehicleStatus = "AVAILABLE" | "IN_USE" | "MAINTENANCE" | "INACTIVE";

export interface VehicleFormData {
  license_plate: string;
  brand: string;
  model: string;
  year: number;
  max_passengers: number;
  status: VehicleStatus;
}

interface VehicleFormProps {
  // `initialData` is the prop name used elsewhere in the app (e.g., Responsive*Layout),
  // but some places may pass `vehicle`. Support both for backward compatibility.
  initialData?: VehicleFormData;
  vehicle?: VehicleFormData;
  onSubmit: (data: VehicleFormData) => void;
  onClose?: () => void;
}

export const VehicleForm = ({ initialData, vehicle, onSubmit, onClose }: VehicleFormProps) => {
  const [form, setForm] = useState<VehicleFormData>({
    license_plate: "",
    brand: "",
    model: "",
    year: new Date().getFullYear(),
    max_passengers: 1,
    status: "AVAILABLE",
  });

  // prefer `initialData` if provided, otherwise fall back to `vehicle`
  const data = initialData ?? vehicle;

  useEffect(() => {
    if (data) {
      setForm(data);
    }
  }, [data]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form className="grid form-grid responsive" onSubmit={handleSubmit}>
      <input
        placeholder="Placa"
        required
        value={form.license_plate}
        onChange={(e) => setForm({ ...form, license_plate: e.target.value })}
      />
      <input
        placeholder="Marca"
        required
        value={form.brand}
        onChange={(e) => setForm({ ...form, brand: e.target.value })}
      />
      <input
        placeholder="Modelo"
        required
        value={form.model}
        onChange={(e) => setForm({ ...form, model: e.target.value })}
      />
      <input
        placeholder="Ano"
        type="number"
        required
        value={form.year}
        onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
      />
      <input
        placeholder="Capacidade"
        type="number"
        required
        value={form.max_passengers}
        onChange={(e) => setForm({ ...form, max_passengers: Number(e.target.value) })}
      />
      <select
        value={form.status}
        onChange={(e) => setForm({ ...form, status: e.target.value as VehicleStatus })}
      >
        <option value="AVAILABLE">Disponível</option>
        <option value="IN_USE">Em uso</option>
        <option value="MAINTENANCE">Manutenção</option>
        <option value="INACTIVE">Inativo</option>
      </select>
      <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.5rem" }}>
        <Button type="submit">{data ? "Atualizar" : "Salvar"}</Button>
        {onClose && (
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
          >
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
};