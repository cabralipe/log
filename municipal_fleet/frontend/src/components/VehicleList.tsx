import { useState } from "react";
import { Button } from "./Button";
import { StatusBadge } from "./StatusBadge";
import { Pagination } from "./Pagination";
import { Modal } from "./Modal";
import type { VehicleFormData } from "./VehicleForm";
import "./VehicleList.css";

type Vehicle = VehicleFormData & {
  id: number;
};

interface VehicleListProps {
  vehicles: Vehicle[];
  loading: boolean;
  error: string | null;
  search: string;
  page: number;
  pageSize: number;
  total: number;
  onSearchChange: (search: string) => void;
  onPageSizeChange: (size: number) => void;
  onPageChange: (page: number) => void;
  onEdit: (vehicle: Vehicle) => void;
  onDelete: (id: number) => void;
}

export const VehicleList = ({
  vehicles,
  loading,
  error,
  search,
  page,
  pageSize,
  total,
  onSearchChange,
  onPageSizeChange,
  onPageChange,
  onEdit,
  onDelete,
}: VehicleListProps) => {
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  const openDetails = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
  };

  const closeDetails = () => {
    setSelectedVehicle(null);
  };

  const handleEdit = () => {
    if (!selectedVehicle) return;
    onEdit(selectedVehicle);
    closeDetails();
  };

  const handleDelete = () => {
    if (!selectedVehicle) return;
    onDelete(selectedVehicle.id);
    closeDetails();
  };

  return (
    <div className="vehicle-list">
      <h2>Veículos</h2>
      
      {error && <div className="card" style={{ color: "#f87171" }}>{error}</div>}
      
      <div className="vehicle-list-controls">
        <input
          placeholder="Buscar por placa, modelo ou marca"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="vehicle-search-input"
        />
        
        <div className="vehicle-list-filters">
          <span className="vehicle-list-label">Itens por página</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="vehicle-page-size-select"
          >
            {[5, 8, 10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p>Carregando...</p>
      ) : (
        <>
          <div className="vehicle-gallery">
            {vehicles.map((vehicle) => (
              <button
                key={vehicle.id}
                type="button"
                className="vehicle-card"
                onClick={() => openDetails(vehicle)}
              >
                <div className="vehicle-image-container">
                  {vehicle.image ? (
                    <img
                      src={vehicle.image}
                      alt={`Foto do veículo ${vehicle.license_plate}`}
                      className="vehicle-image"
                      loading="lazy"
                    />
                  ) : (
                    <div className="vehicle-placeholder" aria-label="Sem imagem">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M5 11l1.5-4.5c.3-.8 1-1.5 1.9-1.5h7.2c.9 0 1.6.7 1.9 1.5L19 11m-1 0h2a1 1 0 011 1v5a1 1 0 01-1 1h-1a2 2 0 01-4 0H9a2 2 0 01-4 0H4a1 1 0 01-1-1v-5a1 1 0 011-1h2m1 0h10m-8 5a1 1 0 100 2 1 1 0 000-2zm10 0a1 1 0 100 2 1 1 0 000-2z"
                          fill="currentColor"
                        />
                      </svg>
                      <span>Sem imagem</span>
                    </div>
                  )}
                  <div className="vehicle-overlay">
                    <div className="vehicle-plate">{vehicle.license_plate}</div>
                    <StatusBadge status={vehicle.status} />
                  </div>
                </div>
                <div className="vehicle-card-content">
                  <div className="vehicle-info-row">
                    <span className="vehicle-info-label">Marca</span>
                    <span>{vehicle.brand}</span>
                  </div>
                  <div className="vehicle-info-row">
                    <span className="vehicle-info-label">Modelo</span>
                    <span>{vehicle.model}</span>
                  </div>
                  <div className="vehicle-info-row">
                    <span className="vehicle-info-label">Ano</span>
                    <span>{vehicle.year}</span>
                  </div>
                  <div className="vehicle-info-row">
                    <span className="vehicle-info-label">Capacidade</span>
                    <span>{vehicle.max_passengers}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
      
      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        onChange={onPageChange}
      />

      <Modal
        open={Boolean(selectedVehicle)}
        onClose={closeDetails}
        title={selectedVehicle ? `Veículo ${selectedVehicle.license_plate}` : undefined}
      >
        {selectedVehicle && (
          <div className="vehicle-details-grid">
            {selectedVehicle.image ? (
              <img
                src={selectedVehicle.image}
                alt={`Foto do veículo ${selectedVehicle.license_plate}`}
                className="vehicle-detail-image"
              />
            ) : (
              <div className="vehicle-detail-placeholder">
                <span>Sem imagem</span>
              </div>
            )}
            <div className="vehicle-detail-info">
              <div className="detail-item">
                <span className="detail-label">Placa</span>
                <span className="detail-value">{selectedVehicle.license_plate}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Marca</span>
                <span className="detail-value">{selectedVehicle.brand}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Modelo</span>
                <span className="detail-value">{selectedVehicle.model}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Ano</span>
                <span className="detail-value">{selectedVehicle.year}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Capacidade</span>
                <span className="detail-value">{selectedVehicle.max_passengers}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Status</span>
                <span className="detail-value">
                  <StatusBadge status={selectedVehicle.status} />
                </span>
              </div>
              <div className="vehicle-detail-actions">
                <Button onClick={handleEdit}>Editar</Button>
                <Button variant="ghost" onClick={handleDelete}>
                  Excluir
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
