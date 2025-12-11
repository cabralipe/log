import { useState } from "react";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { Modal } from "./Modal";
import { FloatingActionButton } from "./FloatingActionButton";
import { MaintenanceForm, type MaintenanceFormData } from "./MaintenanceForm";
import { MaintenanceList } from "./MaintenanceList";
import { Button } from "./Button";
import { Pagination } from "./Pagination";
import { Wrench } from "lucide-react";
import { MaintenanceRecord } from "../types/maintenance";
import "./ResponsiveMaintenanceLayout.css";

interface Vehicle {
  id: number;
  license_plate: string;
  brand: string;
  model: string;
}

interface ResponsiveMaintenanceLayoutProps {
  records: MaintenanceRecord[];
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
  onCreateMaintenance: (data: MaintenanceFormData) => void;
  onUpdateMaintenance: (id: string, data: MaintenanceFormData) => void;
  onDeleteMaintenance: (id: string) => void;
}

export const ResponsiveMaintenanceLayout = ({
  records,
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
  onCreateMaintenance,
  onUpdateMaintenance,
  onDeleteMaintenance,
}: ResponsiveMaintenanceLayoutProps) => {
  const { isMobile, isTablet, isDesktop } = useMediaQuery();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);

  const handleCreateClick = () => {
    setEditingRecord(null);
    setIsModalOpen(true);
  };

  const handleEditClick = (record: MaintenanceRecord) => {
    setEditingRecord(record);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    if (window.confirm("Tem certeza que deseja excluir este registro de manutenção?")) {
      onDeleteMaintenance(id);
    }
  };

  const handleFormSubmit = (formData: MaintenanceFormData) => {
    if (editingRecord) {
      onUpdateMaintenance(editingRecord.id, formData);
    } else {
      onCreateMaintenance(formData);
    }
    setIsModalOpen(false);
    setEditingRecord(null);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingRecord(null);
  };

  const vehicleLabel = (vehicleId: number) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    return vehicle ? `${vehicle.license_plate} - ${vehicle.brand} ${vehicle.model}` : `Veículo ${vehicleId}`;
  };

  const renderForm = () => (
    <MaintenanceForm
      vehicles={vehicles}
      initialData={editingRecord ? {
        vehicle: editingRecord.vehicleId,
        serviceType: editingRecord.serviceType,
        description: editingRecord.description,
        scheduledDate: editingRecord.scheduledDate,
        mileage: editingRecord.mileage,
        cost: editingRecord.cost,
        status: editingRecord.status,
        nextMaintenanceDate: editingRecord.nextMaintenanceDate,
      } : undefined}
      isModal={isMobile}
      onSubmit={handleFormSubmit}
      onCancel={isMobile ? handleModalClose : undefined}
    />
  );

  return (
    <div className="responsive-maintenance-layout">
      <div className="responsive-maintenance-container">
        {/* Mobile Layout */}
        {isMobile && (
          <div className="mobile-layout">
            <div className="maintenance-list-section">
              <div className="maintenance-header">
                <h2>Histórico de Manutenções</h2>
                {error && <div className="error-message">{error}</div>}
              </div>
              
              <div className="maintenance-controls">
                <input
                  placeholder="Buscar por veículo ou descrição"
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="maintenance-search-input"
                />
                
                <div className="maintenance-filters">
                  <span className="maintenance-label">Itens por página</span>
                  <select
                    value={pageSize}
                    onChange={(e) => onPageSizeChange(Number(e.target.value))}
                    className="maintenance-page-size-select"
                  >
                    {[5, 8, 10, 20, 50].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <MaintenanceList
                records={records}
                onEdit={handleEditClick}
                onDelete={handleDeleteClick}
                loading={loading}
              />
              
              <Pagination
                page={page}
                pageSize={pageSize}
                total={total}
                onChange={onPageChange}
              />
            </div>
            
            <FloatingActionButton
              onClick={handleCreateClick}
              aria-label="Registrar manutenção"
              icon={<Wrench size={24} />}
              ariaControls="maintenance-modal"
              ariaExpanded={isModalOpen}
            />
            
            <Modal
              open={isModalOpen}
              onClose={handleModalClose}
              title={editingRecord ? "Editar Manutenção" : "Registrar Manutenção"}
              id="maintenance-modal"
            >
              {renderForm()}
            </Modal>
          </div>
        )}

        {/* Tablet Layout */}
        {isTablet && (
          <div className="tablet-layout">
            <div className="responsive-maintenance-content">
              <div className="maintenance-list-section">
                <div className="form-container" style={{ marginBottom: "1rem" }}>
                  {renderForm()}
                </div>
                <div className="maintenance-header">
                  <h2>Histórico de Manutenções</h2>
                  {error && <div className="error-message">{error}</div>}
                </div>
                
                <div className="maintenance-controls">
                  <input
                    placeholder="Buscar por veículo ou descrição"
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="maintenance-search-input"
                  />
                  
                  <div className="maintenance-filters">
                    <span className="maintenance-label">Itens por página</span>
                    <select
                      value={pageSize}
                      onChange={(e) => onPageSizeChange(Number(e.target.value))}
                      className="maintenance-page-size-select"
                    >
                      {[5, 8, 10, 20, 50].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <MaintenanceList
                  records={records}
                  onEdit={handleEditClick}
                  onDelete={handleDeleteClick}
                  loading={loading}
                />
                
                <Pagination
                  page={page}
                  pageSize={pageSize}
                  total={total}
                  onChange={onPageChange}
                />
              </div>
              
              
            </div>
          </div>
        )}

        {/* Desktop Layout */}
        {isDesktop && (
          <div className="desktop-layout">
            <div className="responsive-maintenance-content">
              <div className="maintenance-list-section">
                <div className="form-container" style={{ marginBottom: "1rem" }}>
                  {renderForm()}
                </div>
                <div className="maintenance-header">
                  <h2>Histórico de Manutenções</h2>
                  {error && <div className="error-message">{error}</div>}
                </div>
                
                <div className="maintenance-controls">
                  <input
                    placeholder="Buscar por veículo ou descrição"
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="maintenance-search-input"
                  />
                  
                  <div className="maintenance-filters">
                    <span className="maintenance-label">Itens por página</span>
                    <select
                      value={pageSize}
                      onChange={(e) => onPageSizeChange(Number(e.target.value))}
                      className="maintenance-page-size-select"
                    >
                      {[5, 8, 10, 20, 50].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <MaintenanceList
                  records={records}
                  onEdit={handleEditClick}
                  onDelete={handleDeleteClick}
                  loading={loading}
                />
                
                <Pagination
                  page={page}
                  pageSize={pageSize}
                  total={total}
                  onChange={onPageChange}
                />
              </div>
              
              
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
