import { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";
import workerPath from "qr-scanner/qr-scanner-worker.min.js?url";
import { api } from "../lib/api";
import { Button } from "../components/Button";
import { AlertTriangle, Camera, CheckCircle2, XCircle } from "lucide-react";
import "./CardValidator.css";

type ValidationResult = {
    valid: boolean;
    reason?: string | null;
    card?: {
        card_number: string;
        status: string;
        expiration_date: string;
    };
    student?: {
        id: number;
        full_name: string;
        school?: string | null;
        grade?: string | null;
        shift?: string | null;
    };
};

export const CardValidatorPage = () => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const scannerRef = useRef<QrScanner | null>(null);
    const [payload, setPayload] = useState("");
    const [result, setResult] = useState<ValidationResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [cameraReady, setCameraReady] = useState(false);
    const [lastDecoded, setLastDecoded] = useState("");
    const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);

    useEffect(() => {
        QrScanner.WORKER_PATH = workerPath;
    }, []);

    useEffect(() => {
        const setupScanner = async () => {
            if (!videoRef.current) return;
            try {
                const available = await QrScanner.listCameras(true);
                setCameras(available);
                if (!selectedCameraId && available[0]) {
                    setSelectedCameraId(available[0].id);
                }
            } catch (err: any) {
                setCameraError("Não foi possível listar câmeras.");
            }
        };
        setupScanner();
        return () => {
            scannerRef.current?.stop();
            scannerRef.current?.destroy();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoRef]);

    useEffect(() => {
        const startScanner = async () => {
            if (!videoRef.current || !selectedCameraId) return;
            scannerRef.current?.stop();
            scannerRef.current?.destroy();
            const scanner = new QrScanner(
                videoRef.current,
                (res) => {
                    const text = typeof res === "string" ? res : res.data;
                    if (text && text !== lastDecoded) {
                        setLastDecoded(text);
                        setPayload(text);
                        handleValidate(text);
                    }
                },
                {
                    highlightScanRegion: true,
                    highlightCodeOutline: true,
                    onDecodeError: () => {},
                    preferredCamera: selectedCameraId,
                    maxScansPerSecond: 8,
                    returnDetailedScanResult: true,
                }
            );
            scannerRef.current = scanner;
            try {
                await scanner.start();
                setCameraReady(true);
                setCameraError(null);
            } catch (err: any) {
                setCameraReady(false);
                setCameraError("Não foi possível acessar a câmera. Permita o acesso ou escolha outra.");
            }
        };
        startScanner();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCameraId]);

    const handleValidate = async (rawPayload?: string) => {
        const value = (rawPayload ?? payload).trim();
        if (!value) return;
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            const { data } = await api.get<ValidationResult>("/students/student-cards/validate/", {
                params: { payload: value },
            });
            setResult(data);
        } catch (err: any) {
            const reason = err.response?.data?.reason || err.response?.data?.detail || "Falha na validação";
            setError(reason);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card-validator">
        <div className="card header">
            <div>
                <p className="eyebrow">Validação de carteirinha</p>
                <h1>Escaneie ou digite o QR code</h1>
                <p className="muted">Use a câmera para ler o QR da carteirinha ou cole o payload.</p>
            </div>
            <div className="badge" style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                <Camera size={18} />
                {cameraReady ? "Câmera ativa" : "Aguardando câmera"}
            </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: "1.3fr 1fr", gap: "1rem" }}>
            <div className="card">
                <div className="video-wrapper">
                    <video ref={videoRef} muted playsInline />
                </div>
                <div className="input-row" style={{ marginTop: "0.5rem" }}>
                    <select
                        value={selectedCameraId ?? ""}
                        onChange={(e) => setSelectedCameraId(e.target.value)}
                        disabled={cameras.length === 0}
                    >
                        {cameras.length === 0 && <option value="">Nenhuma câmera encontrada</option>}
                        {cameras.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.label || c.id}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="input-row">
                    <input
                        placeholder="Payload do QR code"
                        value={payload}
                        onChange={(e) => setPayload(e.target.value)}
                    />
                    <Button type="button" onClick={() => handleValidate()} disabled={loading || !payload}>
                        {loading ? "Validando..." : "Validar"}
                    </Button>
                </div>
                {(error || cameraError) && (
                    <div className="alert error" style={{ marginTop: "0.75rem" }}>
                        <AlertTriangle size={18} /> {error || cameraError}
                    </div>
                )}
            </div>

                <div className="card">
                    <p className="eyebrow">Resultado</p>
                    {!result && !error && <p className="muted">Aguarde um QR ou informe o payload para validar.</p>}
                    {result && (
                        <div className="result">
                            <div className={`status ${result.valid ? "ok" : "bad"}`}>
                                {result.valid ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
                                <div>
                                    <strong>{result.valid ? "Carteirinha válida" : "Carteirinha inválida"}</strong>
                                    {result.reason && <p className="muted">{result.reason}</p>}
                                </div>
                            </div>
                            {result.card && (
                                <div className="info-block">
                                    <p className="eyebrow">Carteirinha</p>
                                    <div className="muted">Número: {result.card.card_number}</div>
                                    <div className="muted">Validade: {result.card.expiration_date}</div>
                                    <div className="muted">Status: {result.card.status}</div>
                                </div>
                            )}
                            {result.student && (
                                <div className="info-block">
                                    <p className="eyebrow">Aluno</p>
                                    <div className="muted">{result.student.full_name}</div>
                                    {result.student.school && <div className="muted">Escola: {result.student.school}</div>}
                                    {result.student.shift && <div className="muted">Turno: {result.student.shift}</div>}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
