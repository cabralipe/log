import { useState, useEffect } from "react";
import { Button } from "./Button";
import "./VehicleForm.css";

export type VehicleStatus = "AVAILABLE" | "IN_USE" | "MAINTENANCE" | "INACTIVE";
export type VehicleCategory = "PASSENGER" | "CARGO" | "SERVICE" | "HOSPITAL";

export interface VehicleFormData {
  license_plate: string;
  brand: string;
  model: string;
  year: number;
  max_passengers: number;
  status: VehicleStatus;
  category: VehicleCategory;
  image?: string | null;
  imageFile?: File | null;
  removeImage?: boolean;
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
    category: "PASSENGER",
    image: null,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);

  // prefer `initialData` if provided, otherwise fall back to `vehicle`
  const data = initialData ?? vehicle;

  useEffect(() => {
    if (data) {
      setForm((prev) => ({
        ...prev,
        ...data,
        category: data.category ?? "PASSENGER",
      }));
    }
    setImageFile(null);
    setRemoveImage(false);
    setImagePreview(data?.image ?? null);
  }, [data]);

  useEffect(() => {
    if (!imageFile) return;
    const objectUrl = URL.createObjectURL(imageFile);
    setImagePreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [imageFile]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ ...form, imageFile, removeImage });
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setImageFile(file);
    setRemoveImage(false);
    if (!file && data?.image) {
      setImagePreview(data.image ?? null);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(true);
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
        value={form.category}
        onChange={(e) => setForm({ ...form, category: e.target.value as VehicleCategory })}
      >
        <option value="PASSENGER">Transporte de passageiros</option>
        <option value="CARGO">Carga</option>
        <option value="SERVICE">Serviço</option>
        <option value="HOSPITAL">Hospitalar</option>
      </select>
      <select
        value={form.status}
        onChange={(e) => setForm({ ...form, status: e.target.value as VehicleStatus })}
      >
        <option value="AVAILABLE">Disponível</option>
        <option value="IN_USE">Em uso</option>
        <option value="MAINTENANCE">Manutenção</option>
        <option value="INACTIVE">Inativo</option>
      </select>
      <div className="vehicle-image-field">
        <label className="vehicle-image-label" htmlFor="vehicle-image-input">
          Imagem (opcional)
        </label>
        <input
          id="vehicle-image-input"
          type="file"
          accept="image/*"
          onChange={handleImageChange}
        />
        {imagePreview ? (
          <div className="vehicle-image-preview">
            <img src={imagePreview} alt="Pré-visualização do veículo" />
            <div className="vehicle-image-actions">
              <Button type="button" variant="ghost" onClick={handleRemoveImage}>
                Remover imagem
              </Button>
            </div>
          </div>
        ) : (
          <div className="vehicle-image-placeholder">
            Nenhuma imagem selecionada.
          </div>
        )}
      </div>
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
