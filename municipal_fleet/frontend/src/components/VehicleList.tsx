import { Table } from "./Table";
import { Button } from "./Button";
import { StatusBadge } from "./StatusBadge";
import { Pagination } from "./Pagination";
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
          {/* Desktop/Tablet Table View */}
          <div className="vehicle-table">
            <Table
              columns={[
                { key: "license_plate", label: "Placa" },
                { key: "brand", label: "Marca" },
                { key: "model", label: "Modelo" },
                { key: "year", label: "Ano" },
                { key: "max_passengers", label: "Cap." },
                { 
                  key: "status", 
                  label: "Status", 
                  render: (row) => <StatusBadge status={row.status} /> 
                },
                {
                  key: "actions",
                  label: "Ações",
                  render: (row) => (
                    <div className="vehicle-actions">
                      <Button variant="ghost" onClick={() => onEdit(row)}>
                        Editar
                      </Button>
                      <Button variant="ghost" onClick={() => onDelete(row.id)}>
                        Excluir
                      </Button>
                    </div>
                  ),
                },
              ]}
              data={vehicles}
            />
          </div>
          
          {/* Mobile Card View */}
          <div className="vehicle-cards">
            {vehicles.map((vehicle) => (
              <div key={vehicle.id} className="vehicle-card">
                <div className="vehicle-card-header">
                  <div className="vehicle-card-title">{vehicle.license_plate}</div>
                  <StatusBadge status={vehicle.status} />
                </div>
                <div className="vehicle-card-body">
                  <div className="vehicle-card-item">
                    <span className="vehicle-card-label">Marca</span>
                    <span className="vehicle-card-value">{vehicle.brand}</span>
                  </div>
                  <div className="vehicle-card-item">
                    <span className="vehicle-card-label">Modelo</span>
                    <span className="vehicle-card-value">{vehicle.model}</span>
                  </div>
                  <div className="vehicle-card-item">
                    <span className="vehicle-card-label">Ano</span>
                    <span className="vehicle-card-value">{vehicle.year}</span>
                  </div>
                  <div className="vehicle-card-item">
                    <span className="vehicle-card-label">Capacidade</span>
                    <span className="vehicle-card-value">{vehicle.max_passengers}</span>
                  </div>
                </div>
                <div className="vehicle-card-actions">
                  <Button variant="ghost" onClick={() => onEdit(vehicle)}>
                    Editar
                  </Button>
                  <Button variant="ghost" onClick={() => onDelete(vehicle.id)}>
                    Excluir
                  </Button>
                </div>
              </div>
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
    </div>
  );
};