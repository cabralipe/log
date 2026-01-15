import React from "react";
import "./DriverFuel.css";
import { FuelLogPortal, FuelStation } from "../types";

type DriverFuelProps = {
    fuelLogs: FuelLogPortal[];
    fuelForm: {
        vehicle: number | "";
        fuel_station_id: number | "";
        filled_at: string;
        liters: string;
        price_per_liter: string;
        notes: string;
        receipt_image: File | null;
    };
    setFuelForm: React.Dispatch<React.SetStateAction<{
        vehicle: number | "";
        fuel_station_id: number | "";
        filled_at: string;
        liters: string;
        price_per_liter: string;
        notes: string;
        receipt_image: File | null;
    }>>;
    handleFuelSubmit: (e: React.FormEvent) => void;
    availableVehicles: { id: number; plate: string }[];
    stations: FuelStation[];
};

export const DriverFuel: React.FC<DriverFuelProps> = ({
    fuelLogs,
    fuelForm,
    setFuelForm,
    handleFuelSubmit,
    availableVehicles,
    stations,
}) => {

    return (
        <div className="dp-fuel fade-in">
            <form onSubmit={handleFuelSubmit}>
                {/* Vehicle & Station Selection */}
                <div className="dp-glass-card" style={{ margin: '1rem' }}>
                    <div className="dp-glass-card__body">
                        <div className="dp-form-group">
                            <label className="dp-form-label">Veículo</label>
                            <select
                                className="dp-select"
                                value={fuelForm.vehicle}
                                onChange={(e) => setFuelForm((f) => ({ ...f, vehicle: Number(e.target.value) }))}
                                required
                            >
                                <option value="">Selecionar Veículo</option>
                                {availableVehicles.map((v) => (
                                    <option key={v.id} value={v.id}>{v.plate}</option>
                                ))}
                            </select>
                        </div>
                        <div className="dp-form-group" style={{ marginBottom: 0 }}>
                            <label className="dp-form-label">Posto de Combustível</label>
                            <select
                                className="dp-select"
                                value={fuelForm.fuel_station_id}
                                onChange={(e) => setFuelForm((f) => ({ ...f, fuel_station_id: Number(e.target.value) }))}
                                required
                            >
                                <option value="">Selecionar Posto</option>
                                {stations.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Details Section */}
                <div style={{ padding: '0 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <span className="material-symbols-outlined" style={{ color: 'var(--dp-primary)' }}>analytics</span>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Detalhes</h3>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                        <div className="dp-form-group" style={{ marginBottom: 0 }}>
                            <label className="dp-form-label">Litros</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="dp-input dp-input--large"
                                    placeholder="0,00"
                                    value={fuelForm.liters}
                                    onChange={(e) => setFuelForm((f) => ({ ...f, liters: e.target.value }))}
                                    required
                                />
                                <span style={{
                                    position: 'absolute',
                                    bottom: '0.5rem',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    fontSize: '0.6rem',
                                    fontWeight: 700,
                                    color: 'var(--dp-primary)',
                                    textTransform: 'uppercase'
                                }}>LITROS</span>
                            </div>
                        </div>
                        <div className="dp-form-group" style={{ marginBottom: 0 }}>
                            <label className="dp-form-label">Valor Total</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="dp-input dp-input--large"
                                    placeholder="0,00"
                                    value={fuelForm.price_per_liter}
                                    onChange={(e) => setFuelForm((f) => ({ ...f, price_per_liter: e.target.value }))}
                                    required
                                    style={{ color: 'var(--dp-primary)' }}
                                />
                                <span style={{
                                    position: 'absolute',
                                    bottom: '0.5rem',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    fontSize: '0.6rem',
                                    fontWeight: 700,
                                    color: 'var(--dp-primary)',
                                    textTransform: 'uppercase'
                                }}>REAIS (R$)</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Receipt Upload */}
                <div style={{ padding: '0 1rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <span className="material-symbols-outlined" style={{ color: 'var(--dp-primary)' }}>receipt_long</span>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Comprovante</h3>
                    </div>

                    <label className="dp-file-upload">
                        <div className="dp-file-upload__icon">
                            <span className="material-symbols-outlined">add_a_photo</span>
                        </div>
                        <div className="dp-file-upload__text">
                            <p className="dp-file-upload__title">
                                {fuelForm.receipt_image ? fuelForm.receipt_image.name : 'Anexar Nota Fiscal'}
                            </p>
                            <p className="dp-file-upload__hint">
                                {fuelForm.receipt_image ? 'Toque para trocar' : 'Toque para abrir a câmera'}
                            </p>
                        </div>
                        <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            style={{ display: 'none' }}
                            onChange={(e) => setFuelForm((f) => ({ ...f, receipt_image: e.target.files?.[0] || null }))}
                        />
                    </label>
                </div>

                {/* Notes */}
                <div style={{ padding: '0 1rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <span className="material-symbols-outlined" style={{ color: 'var(--dp-primary)' }}>edit_note</span>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Observações</h3>
                    </div>
                    <textarea
                        className="dp-textarea"
                        rows={3}
                        placeholder="Adicione informações extras aqui..."
                        value={fuelForm.notes}
                        onChange={(e) => setFuelForm((f) => ({ ...f, notes: e.target.value }))}
                    />
                </div>

                {/* Submit Button */}
                <div className="dp-bottom-action">
                    <button type="submit" className="dp-btn dp-btn--success dp-btn--xl">
                        <span className="material-symbols-outlined" style={{ fontSize: '2rem' }}>save</span>
                        Salvar Abastecimento
                    </button>
                </div>
            </form>

            {/* History */}
            {fuelLogs.length > 0 && (
                <div style={{ padding: '1rem', marginTop: '4rem' }}>
                    <h3 className="dp-section-title" style={{ padding: '0 0 0.75rem' }}>Histórico Recente</h3>
                    <div className="dp-updates">
                        {fuelLogs.slice(0, 5).map((log) => (
                            <div key={log.id} className="dp-update-item">
                                <div className="dp-update-item__icon dp-update-item__icon--primary">
                                    <span className="material-symbols-outlined">local_gas_station</span>
                                </div>
                                <div className="dp-update-item__content">
                                    <p className="dp-update-item__title">{log.fuel_station}</p>
                                    <p className="dp-update-item__desc">{log.vehicle__license_plate} · {log.filled_at}</p>
                                </div>
                                <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--dp-primary)' }}>{log.liters}L</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
