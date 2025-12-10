import { useState } from "react";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { Modal } from "./Modal";
import { FloatingActionButton } from "./FloatingActionButton";
import { VehicleForm, type VehicleFormData } from "./VehicleForm";
import { VehicleList } from "./VehicleList";
import "./ResponsiveVehicleLayout.css";

interface Vehicle extends VehicleFormData {
  id: number;
}

interface ResponsiveVehicleLayoutProps {
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
  onCreateVehicle: (vehicle: VehicleFormData) => void;
  onUpdateVehicle: (id: number, vehicle: VehicleFormData) => void;
  onDeleteVehicle: (id: number) => void;
}

export const ResponsiveVehicleLayout = ({
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
  onCreateVehicle,
  onUpdateVehicle,
  onDeleteVehicle,
}: ResponsiveVehicleLayoutProps) => {
  const { isMobile, isTablet, isDesktop } = useMediaQuery();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  const handleCreateClick = () => {
    setEditingVehicle(null);
    setIsModalOpen(true);
  };

  const handleEditClick = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (id: number) => {
    if (window.confirm("Tem certeza que deseja excluir este veículo?")) {
      onDeleteVehicle(id);
    }
  };

  const handleFormSubmit = (formData: VehicleFormData) => {
    if (editingVehicle) {
      onUpdateVehicle(editingVehicle.id, formData);
    } else {
      onCreateVehicle(formData);
    }
    setIsModalOpen(false);
    setEditingVehicle(null);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingVehicle(null);
  };

  const renderForm = () => (
    <VehicleForm
      initialData={editingVehicle || undefined}
      onSubmit={handleFormSubmit}
      onCancel={handleModalClose}
    />
  );

  return (
    <div className="responsive-vehicle-layout">
      <div className="responsive-vehicle-container">
        {/* Mobile Layout */}
        {isMobile && (
          <div className="mobile-layout">
            <VehicleList
              vehicles={vehicles}
              loading={loading}
              error={error}
              search={search}
              page={page}
              pageSize={pageSize}
              total={total}
              onSearchChange={onSearchChange}
              onPageSizeChange={onPageSizeChange}
              onPageChange={onPageChange}
              onEdit={handleEditClick}
              onDelete={handleDeleteClick}
            />
            <FloatingActionButton
              onClick={handleCreateClick}
              aria-label="Adicionar novo veículo"
            />
            <Modal
              isOpen={isModalOpen}
              onClose={handleModalClose}
              title={editingVehicle ? "Editar Veículo" : "Novo Veículo"}
            >
              {renderForm()}
            </Modal>
          </div>
        )}

        {/* Tablet Layout */}
        {isTablet && (
          <div className="tablet-layout">
            <div className="tablet-content">
              <VehicleList
                vehicles={vehicles}
                loading={loading}
                error={error}
                search={search}
                page={page}
                pageSize={pageSize}
                total={total}
                onSearchChange={onSearchChange}
                onPageSizeChange={onPageSizeChange}
                onPageChange={onPageChange}
                onEdit={handleEditClick}
                onDelete={handleDeleteClick}
              />
              <div className="tablet-sidebar">
                <div className="form-container card">
                  <h3>{editingVehicle ? "Editar Veículo" : "Novo Veículo"}</h3>
                  {renderForm()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Desktop Layout */}
        {isDesktop && (
          <div className="desktop-layout">
            <div className="desktop-content">
              <div className="desktop-main">
                <VehicleList
                  vehicles={vehicles}
                  loading={loading}
                  error={error}
                  search={search}
                  page={page}
                  pageSize={pageSize}
                  total={total}
                  onSearchChange={onSearchChange}
                  onPageSizeChange={onPageSizeChange}
                  onPageChange={onPageChange}
                  onEdit={handleEditClick}
                  onDelete={handleDeleteClick}
                />
              </div>
              <div className="desktop-sidebar">
                <div className="form-container card">
                  <h3>{editingVehicle ? "Editar Veículo" : "Novo Veículo"}</h3>
                  {renderForm()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
