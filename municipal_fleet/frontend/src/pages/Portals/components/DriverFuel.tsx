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
            <form onSubmit={handleFuelSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Vehicle & Station Selection */}
                <div className="dp-glass-card">
                    <div className="dp-form-group">
                        <label className="dp-form-label">Veículo</label>
                        <select
                            className="dp-input"
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
                    <div className="dp-form-group" style={{ marginTop: '1rem' }}>
                        <label className="dp-form-label">Posto de Combustível</label>
                        <select
                            className="dp-input"
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

                {/* Details Section */}
                <div className="dp-fuel-grid">
                    <div className="dp-glass-card">
                        <label className="dp-form-label">Litros</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="number"
                                step="0.01"
                                className="dp-input"
                                style={{ fontSize: '1.25rem' }}
                                placeholder="0,00"
                                value={fuelForm.liters}
                                onChange={(e) => setFuelForm((f) => ({ ...f, liters: e.target.value }))}
                                required
                            />
                            <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--dp-muted)', fontWeight: 700 }}>L</span>
                        </div>
                    </div>
                    <div className="dp-glass-card">
                        <label className="dp-form-label">Valor Total</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="number"
                                step="0.01"
                                className="dp-input"
                                style={{ fontSize: '1.25rem', color: 'var(--dp-accent)' }}
                                placeholder="0,00"
                                value={fuelForm.price_per_liter}
                                onChange={(e) => setFuelForm((f) => ({ ...f, price_per_liter: e.target.value }))}
                                required
                            />
                            <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--dp-muted)', fontWeight: 700 }}>R$</span>
                        </div>
                    </div>
                </div>

                {/* Receipt Upload */}
                <div className="dp-glass-card">
                    <label className="dp-form-label">Comprovante / Nota Fiscal</label>
                    <label className="dp-file-upload" style={{ marginTop: '0.5rem' }}>
                        <div className="dp-file-upload__icon">
                            <span className="material-symbols-outlined">add_a_photo</span>
                        </div>
                        <div className="dp-file-upload__text">
                            <p className="dp-file-upload__title">
                                {fuelForm.receipt_image ? fuelForm.receipt_image.name : 'Anexar Comprovante'}
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
                <div className="dp-glass-card">
                    <label className="dp-form-label">Observações</label>
                    <textarea
                        className="dp-input"
                        style={{ minHeight: '80px', paddingTop: '0.75rem' }}
                        placeholder="Informações adicionais..."
                        value={fuelForm.notes}
                        onChange={(e) => setFuelForm((f) => ({ ...f, notes: e.target.value }))}
                    />
                </div>

                {/* Submit Button */}
                <div className="dp-bottom-action" style={{ position: 'sticky', bottom: '1rem', zIndex: 10 }}>
                    <button type="submit" className="dp-btn dp-btn--primary" style={{ width: '100%', padding: '1.25rem', fontSize: '1.1rem', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
                        <span className="material-symbols-outlined">save</span>
                        SALVAR COMBUSTÍVEL
                    </button>
                </div>
            </form>

            {/* History */}
            {fuelLogs.length > 0 && (
                <div className="dp-fuel-history">
                    <h3 className="dp-fuel-history__title">Histórico Recente</h3>
                    {fuelLogs.slice(0, 5).map((log) => (
                        <div key={log.id} className="dp-fuel-item">
                            <div className="dp-fuel-item__info">
                                <div className="dp-fuel-item__icon">
                                    <span className="material-symbols-outlined">local_gas_station</span>
                                </div>
                                <div className="dp-fuel-item__details">
                                    <p className="station">{log.fuel_station}</p>
                                    <p className="meta">{log.vehicle__license_plate} · {log.filled_at}</p>
                                </div>
                            </div>
                            <div className="dp-fuel-item__value">
                                <span className="liters">{log.liters}L</span>
                                <span className="price">R$ {log.price_per_liter}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
