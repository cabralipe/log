import { useState } from "react";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { Modal } from "./Modal";
import { FloatingActionButton } from "./FloatingActionButton";
import { DriverForm, type DriverFormData } from "./DriverForm";
import { DriverList } from "./DriverList";
import { Button } from "./Button";
import { Pagination } from "./Pagination";
import { UserPlus } from "lucide-react";
import { Driver } from "../types/driver";
import "./ResponsiveDriverLayout.css";

interface ResponsiveDriverLayoutProps {
  drivers: Driver[];
  loading: boolean;
  error: string | null;
  search: string;
  page: number;
  pageSize: number;
  total: number;
  onSearchChange: (search: string) => void;
  onPageSizeChange: (size: number) => void;
  onPageChange: (page: number) => void;
  onCreateDriver: (data: DriverFormData) => void;
  onUpdateDriver: (id: number, data: DriverFormData) => void;
  onDeleteDriver: (id: number) => void;
}

export const ResponsiveDriverLayout = ({
  drivers,
  loading,
  error,
  search,
  page,
  pageSize,
  total,
  onSearchChange,
  onPageSizeChange,
  onPageChange,
  onCreateDriver,
  onUpdateDriver,
  onDeleteDriver,
}: ResponsiveDriverLayoutProps) => {
  const { isMobile, isTablet, isDesktop } = useMediaQuery();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);

  const handleCreateClick = () => {
    setEditingDriver(null);
    setIsModalOpen(true);
  };

  const handleEditClick = (driver: Driver) => {
    setEditingDriver(driver);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (id: number) => {
    if (confirm("Deseja remover este motorista?")) {
      onDeleteDriver(id);
    }
  };

  const handleFormSubmit = (data: DriverFormData) => {
    if (editingDriver) {
      onUpdateDriver(editingDriver.id, data);
    } else {
      onCreateDriver(data);
    }
    setIsModalOpen(false);
    setEditingDriver(null);
  };

  const handleFormCancel = () => {
    setIsModalOpen(false);
    setEditingDriver(null);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingDriver(null);
  };

  return (
    <div className="responsive-driver-layout">
      <div className="responsive-driver-container">
        <div className="responsive-driver-header">
          <h1 className="responsive-driver-title">Motoristas</h1>
          <p className="responsive-driver-subtitle">
            Gerencie os motoristas do sistema
          </p>
        </div>

        {error && (
          <div className="responsive-driver-error">
            <div className="error-content">
              <span className="error-icon">⚠️</span>
              <span className="error-text">{error}</span>
            </div>
          </div>
        )}

        <div className="responsive-driver-content">
          {/* Desktop/Tablet Layout */}
          {(isDesktop || isTablet) && (
            <>
              <div className="responsive-driver-sidebar">
                <div className="responsive-driver-form-card">
                  <div className="responsive-driver-form-header">
                    <h2 className="responsive-driver-form-title">
                      {editingDriver ? "Editar Motorista" : "Novo Motorista"}
                    </h2>
                    <p className="responsive-driver-form-subtitle">
                      {editingDriver ? "Atualize os dados do motorista" : "Adicione um novo motorista"}
                    </p>
                  </div>
                  <DriverForm
                    initialData={editingDriver}
                    onSubmit={handleFormSubmit}
                    onCancel={editingDriver ? handleFormCancel : undefined}
                  />
                </div>
              </div>

              <div className="responsive-driver-list-section">
                <div className="responsive-driver-list-header">
                  <h2 className="responsive-driver-list-title">Lista de Motoristas</h2>
                  <div className="responsive-driver-controls">
                    <div className="responsive-driver-search-container">
                      <div className="search-icon-container">
                        <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <circle cx="11" cy="11" r="8"></circle>
                          <path d="m21 21-4.35-4.35"></path>
                        </svg>
                      </div>
                      <input
                        type="text"
                        placeholder="Buscar por nome ou CPF..."
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="responsive-driver-search-input"
                        aria-label="Buscar motoristas"
                      />
                    </div>
                    <div className="responsive-driver-page-size-container">
                      <label htmlFor="page-size" className="page-size-label">
                        Itens por página:
                      </label>
                      <select
                        id="page-size"
                        value={pageSize}
                        onChange={(e) => onPageSizeChange(Number(e.target.value))}
                        className="responsive-driver-page-size-select"
                        aria-label="Itens por página"
                      >
                        {[5, 8, 10, 20, 50].map((size) => (
                          <option key={size} value={size}>
                            {size}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="responsive-driver-list-content">
                  <DriverList
                    drivers={drivers}
                    loading={loading}
                    onEdit={handleEditClick}
                    onDelete={handleDeleteClick}
                  />
                  {total > pageSize && (
                    <div className="responsive-driver-pagination-container">
                      <Pagination
                        page={page}
                        pageSize={pageSize}
                        total={total}
                        onChange={onPageChange}
                      />
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Mobile Layout */}
          {isMobile && (
            <div className="responsive-driver-mobile-content">
              <div className="responsive-driver-mobile-header">
                <div className="responsive-driver-search-container">
                  <div className="search-icon-container">
                    <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <circle cx="11" cy="11" r="8"></circle>
                      <path d="m21 21-4.35-4.35"></path>
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Buscar por nome ou CPF..."
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="responsive-driver-search-input"
                    aria-label="Buscar motoristas"
                  />
                </div>
                <div className="responsive-driver-page-size-container">
                  <select
                    value={pageSize}
                    onChange={(e) => onPageSizeChange(Number(e.target.value))}
                    className="responsive-driver-page-size-select"
                    aria-label="Itens por página"
                  >
                    {[5, 8, 10, 20, 50].map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="responsive-driver-list-content">
                <DriverList
                  drivers={drivers}
                  loading={loading}
                  onEdit={handleEditClick}
                  onDelete={handleDeleteClick}
                />
                {total > pageSize && (
                  <div className="responsive-driver-pagination-container">
                    <Pagination
                      page={page}
                      pageSize={pageSize}
                      total={total}
                      onChange={onPageChange}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Floating Action Button for Mobile */}
        {isMobile && (
          <FloatingActionButton
            onClick={handleCreateClick}
            aria-label="Adicionar novo motorista"
            icon={<UserPlus size={24} />}
          />
        )}

        {/* Modal for Mobile */}
        {isMobile && (
          <Modal
            isOpen={isModalOpen}
            onClose={handleModalClose}
            title={editingDriver ? "Editar Motorista" : "Novo Motorista"}
          >
            <div className="responsive-driver-modal-content">
              <DriverForm
                initialData={editingDriver}
                onSubmit={handleFormSubmit}
                onCancel={handleFormCancel}
              />
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
};