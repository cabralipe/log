import { useState, useEffect } from "react";
import { Button } from "./Button";
import { Wrench } from "lucide-react";

export interface MaintenanceFormData {
  vehicle: number;
  description: string;
  date: string;
  mileage: number;
}

interface MaintenanceFormProps {
  vehicles: Array<{ id: number; license_plate: string; brand: string; model: string }>;
  initialData?: Partial<MaintenanceFormData>;
  isModal?: boolean;
  onSubmit: (data: MaintenanceFormData) => void;
  onCancel?: () => void;
  loading?: boolean;
}

export const MaintenanceForm = ({
  vehicles,
  initialData,
  isModal = false,
  onSubmit,
  onCancel,
  loading = false,
}: MaintenanceFormProps) => {
  const [formData, setFormData] = useState<MaintenanceFormData>({
    vehicle: initialData?.vehicle || 0,
    description: initialData?.description || "",
    date: initialData?.date || new Date().toISOString().slice(0, 10),
    mileage: initialData?.mileage || 0,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof MaintenanceFormData, string>>>({});

  useEffect(() => {
    if (initialData) {
      setFormData({
        vehicle: initialData.vehicle || 0,
        description: initialData.description || "",
        date: initialData.date || new Date().toISOString().slice(0, 10),
        mileage: initialData.mileage || 0,
      });
    }
  }, [initialData]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof MaintenanceFormData, string>> = {};

    if (!formData.vehicle) {
      newErrors.vehicle = "Selecione um veículo";
    }

    if (!formData.description.trim()) {
      newErrors.description = "Descrição é obrigatória";
    }

    if (!formData.date) {
      newErrors.date = "Data é obrigatória";
    }

    if (formData.mileage <= 0) {
      newErrors.mileage = "Quilometragem deve ser maior que zero";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const handleChange = (field: keyof MaintenanceFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const vehicleLabel = (vehicleId: number) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    return vehicle ? `${vehicle.license_plate} - ${vehicle.brand} ${vehicle.model}` : "";
  };

  return (
    <div className={`maintenance-form ${isModal ? 'maintenance-form-modal' : ''}`}>
      <div className="maintenance-form-header">
        {!isModal && (
          <div className="maintenance-form-icon">
            <Wrench size={24} />
          </div>
        )}
        <h3>{initialData?.vehicle ? "Editar Manutenção" : "Registrar Manutenção"}</h3>
      </div>

      <form onSubmit={handleSubmit} className="maintenance-form-content">
        <div className="form-group">
          <label htmlFor="vehicle-select">Veículo *</label>
          <select
            id="vehicle-select"
            value={formData.vehicle}
            onChange={(e) => handleChange('vehicle', Number(e.target.value))}
            className={errors.vehicle ? 'error' : ''}
            aria-invalid={!!errors.vehicle}
            aria-describedby={errors.vehicle ? 'vehicle-error' : undefined}
            required
          >
            <option value="">Selecione um veículo</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.license_plate} - {vehicle.brand} {vehicle.model}
              </option>
            ))}
          </select>
          {errors.vehicle && (
            <span id="vehicle-error" className="error-message">{errors.vehicle}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="description-input">Descrição *</label>
          <textarea
            id="description-input"
            placeholder="Descreva os serviços realizados"
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            className={errors.description ? 'error' : ''}
            aria-invalid={!!errors.description}
            aria-describedby={errors.description ? 'description-error' : undefined}
            rows={3}
            required
          />
          {errors.description && (
            <span id="description-error" className="error-message">{errors.description}</span>
          )}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="date-input">Data *</label>
            <input
              id="date-input"
              type="date"
              value={formData.date}
              onChange={(e) => handleChange('date', e.target.value)}
              className={errors.date ? 'error' : ''}
              aria-invalid={!!errors.date}
              aria-describedby={errors.date ? 'date-error' : undefined}
              required
            />
            {errors.date && (
              <span id="date-error" className="error-message">{errors.date}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="mileage-input">Quilometragem *</label>
            <input
              id="mileage-input"
              type="number"
              placeholder="KM"
              value={formData.mileage || ''}
              onChange={(e) => handleChange('mileage', Number(e.target.value))}
              className={errors.mileage ? 'error' : ''}
              aria-invalid={!!errors.mileage}
              aria-describedby={errors.mileage ? 'mileage-error' : undefined}
              min="0"
              step="1"
              required
            />
            {errors.mileage && (
              <span id="mileage-error" className="error-message">{errors.mileage}</span>
            )}
          </div>
        </div>

        <div className="form-actions">
          <Button type="submit" disabled={loading}>
            {loading ? "Salvando..." : (initialData?.vehicle ? "Atualizar" : "Salvar")}
          </Button>
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
              Cancelar
            </Button>
          )}
        </div>
      </form>
    </div>
  );
};