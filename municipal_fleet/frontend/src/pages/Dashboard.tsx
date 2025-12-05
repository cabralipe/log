import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Card } from "../components/Card";
import { Table } from "../components/Table";
import { StatusBadge } from "../components/StatusBadge";

type DashboardData = {
    total_vehicles: number;
    vehicles_by_status: { status: string; total: number }[];
    trips_month_total: number;
    trips_by_status: { status: string; total: number }[];
    odometer_month: { vehicle_id: number; vehicle__license_plate: string; kilometers: number }[];
    maintenance_alerts: { id: number; license_plate: string; next_service_date: string | null }[];
};

export const DashboardPage = () => {
    const [data, setData] = useState<DashboardData | null>(null);

    useEffect(() => {
        api.get<DashboardData>("/reports/dashboard/").then((res) => setData(res.data));
    }, []);

    if (!data) return <p>Carregando...</p>;

    return (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            <Card title="Veículos" value={data.total_vehicles} />
            <Card title="Viagens no mês" value={data.trips_month_total} />
            {data.vehicles_by_status.map((item) => (
                <Card key={item.status} title={`Veículos ${item.status}`} value={item.total} />
            ))}
            <div className="card" style={{ gridColumn: "1 / -1" }}>
                <h3>Alertas de manutenção</h3>
                <Table
                    columns={[
                        { key: "license_plate", label: "Placa" },
                        {
                            key: "next_service_date",
                            label: "Próxima revisão",
                            render: (row) => row.next_service_date ?? "—",
                        },
                    ]}
                    data={data.maintenance_alerts as any}
                />
            </div>
            <div className="card" style={{ gridColumn: "1 / -1" }}>
                <h3>Quilometragem no mês</h3>
                <Table
                    columns={[
                        { key: "vehicle__license_plate", label: "Veículo" },
                        { key: "kilometers", label: "KM" },
                    ]}
                    data={data.odometer_month as any}
                />
            </div>
            <div className="card" style={{ gridColumn: "1 / -1" }}>
                <h3>Status das viagens</h3>
                <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                    {data.trips_by_status.map((item) => (
                        <div key={item.status} className="card" style={{ padding: "0.75rem" }}>
                            <StatusBadge status={item.status} /> <strong>{item.total}</strong>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
