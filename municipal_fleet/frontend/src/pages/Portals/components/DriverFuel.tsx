import React from "react";
import { useMediaQuery } from "../../../hooks/useMediaQuery";
import { Table } from "../../../components/Table";
import { Button } from "../../../components/Button";
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
    const { isMobile } = useMediaQuery();

    // Render Fuel Cards for Mobile
    const renderFuelCards = () => (
        <div className="driver-portal__fuel-cards">
            {fuelLogs.map((log) => (
                <div key={log.id} className="driver-portal__fuel-card">
                    <div className="driver-portal__fuel-card-info">
                        <div className="driver-portal__fuel-card-station">{log.fuel_station}</div>
                        <div className="driver-portal__fuel-card-details">
                            {log.filled_at} · {log.vehicle__license_plate}
                            {log.receipt_image && (
                                <> · <a href={log.receipt_image} target="_blank" rel="noopener noreferrer">Ver nota</a></>
                            )}
                        </div>
                        {(log.price_per_liter || log.total_cost) && (
                            <div className="driver-portal__fuel-card-details">
                                {log.price_per_liter && <>R$ {Number(log.price_per_liter).toFixed(2)} / L</>}
                                {log.total_cost && <> · Total R$ {Number(log.total_cost).toFixed(2)}</>}
                            </div>
                        )}
                    </div>
                    <div className="driver-portal__fuel-card-liters">{log.liters} L</div>
                </div>
            ))}
            {fuelLogs.length === 0 && (
                <div className="driver-portal__empty">Nenhum abastecimento registrado.</div>
            )}
        </div>
    );

    return (
        <section id="abastecimento" className="driver-portal__section fade-in">
            <div className="driver-portal__section-header">
                <h3>Prestação de contas de abastecimento</h3>
            </div>
            <form className="driver-portal__fuel-form" onSubmit={handleFuelSubmit}>
                <select value={fuelForm.vehicle} onChange={(e) => setFuelForm((f) => ({ ...f, vehicle: Number(e.target.value) }))} required>
                    <option value="">Veículo</option>
                    {availableVehicles.map((v) => (
                        <option key={v.id} value={v.id}>{v.plate}</option>
                    ))}
                </select>
                <select value={fuelForm.fuel_station_id} onChange={(e) => setFuelForm((f) => ({ ...f, fuel_station_id: Number(e.target.value) }))} required>
                    <option value="">Posto credenciado</option>
                    {stations.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
                <label>
                    Data do abastecimento
                    <input
                        type="date"
                        value={fuelForm.filled_at}
                        onChange={(e) => setFuelForm((f) => ({ ...f, filled_at: e.target.value }))}
                        required
                    />
                </label>
                <div className="driver-portal__form-row">
                    <label>
                        Litros
                        <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={fuelForm.liters}
                            onChange={(e) => setFuelForm((f) => ({ ...f, liters: e.target.value }))}
                            required
                        />
                    </label>
                    <label>
                        Preço / Litro
                        <input
                            type="number"
                            step="0.01"
                            placeholder="R$ 0.00"
                            value={fuelForm.price_per_liter}
                            onChange={(e) => setFuelForm((f) => ({ ...f, price_per_liter: e.target.value }))}
                            required
                        />
                    </label>
                </div>
                <label className="full-width">
                    Observações
                    <textarea
                        rows={2}
                        placeholder="Opcional"
                        value={fuelForm.notes}
                        onChange={(e) => setFuelForm((f) => ({ ...f, notes: e.target.value }))}
                    />
                </label>
                <label>
                    Foto da nota fiscal
                    <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setFuelForm((f) => ({ ...f, receipt_image: e.target.files?.[0] || null }))}
                    />
                </label>
                <Button type="submit" fullWidth>Registrar abastecimento</Button>
            </form>

            <div className="driver-portal__fuel-history">
                <h4>Histórico recente</h4>
                {isMobile ? (
                    renderFuelCards()
                ) : (
                    <Table
                        columns={[
                            { key: "filled_at", label: "Data" },
                            { key: "vehicle__license_plate", label: "Veículo" },
                            { key: "fuel_station", label: "Posto" },
                            { key: "liters", label: "Litros", render: (row) => `${row.liters} L` },
                            { key: "total_cost", label: "Total", render: (row) => (row.total_cost ? `R$ ${Number(row.total_cost).toFixed(2)}` : "—") },
                            {
                                key: "receipt_image",
                                label: "Nota",
                                render: (row) =>
                                    row.receipt_image ? (
                                        <a href={row.receipt_image} target="_blank" rel="noopener noreferrer">Ver</a>
                                    ) : "—",
                            },
                        ]}
                        data={fuelLogs}
                    />
                )}
            </div>
        </section>
    );
};
