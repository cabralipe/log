import { useState, useEffect } from "react";
import { Driver } from "../types/driver";
import "./DriverForm.css";

export interface DriverFormData {
  name: string;
  cpf: string;
  phone: string;
  cnh_number: string;
  cnh_category: string;
  cnh_expiration_date: string;
  status: "ACTIVE" | "INACTIVE";
  access_code?: string;
}

interface DriverFormProps {
  initialData?: Driver | null;
  onSubmit: (data: DriverFormData) => void;
  onCancel?: () => void;
}

export const DriverForm = ({ initialData, onSubmit, onCancel }: DriverFormProps) => {
  const [formData, setFormData] = useState<DriverFormData>({
    name: "",
    cpf: "",
    phone: "",
    cnh_number: "",
    cnh_category: "B",
    cnh_expiration_date: "",
    status: "ACTIVE",
    access_code: "",
  });

  const [errors, setErrors] = useState<Partial<Record<keyof DriverFormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        cpf: initialData.cpf,
        phone: initialData.phone,
        cnh_number: initialData.cnh_number,
        cnh_category: initialData.cnh_category,
        cnh_expiration_date: initialData.cnh_expiration_date,
        status: initialData.status as "ACTIVE" | "INACTIVE",
        access_code: initialData.access_code || "",
      });
    } else {
      setFormData({
        name: "",
        cpf: "",
        phone: "",
        cnh_number: "",
        cnh_category: "B",
        cnh_expiration_date: "",
        status: "ACTIVE",
        access_code: "",
      });
      setErrors({});
    }
  }, [initialData]);

  const validateCPF = (cpf: string): boolean => {
    // Remove non-numeric characters
    const cleanCPF = cpf.replace(/\D/g, "");
    
    // Basic validation - 11 digits
    if (cleanCPF.length !== 11) return false;
    
    // Check for known invalid CPFs
    if (/^(\d)\1{10}$/.test(cleanCPF)) return false;
    
    // Calculate first verification digit
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
    }
    let remainder = sum % 11;
    let firstDigit = remainder < 2 ? 0 : 11 - remainder;
    
    if (parseInt(cleanCPF.charAt(9)) !== firstDigit) return false;
    
    // Calculate second verification digit
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
    }
    remainder = sum % 11;
    let secondDigit = remainder < 2 ? 0 : 11 - remainder;
    
    return parseInt(cleanCPF.charAt(10)) === secondDigit;
  };

  const formatCPF = (cpf: string): string => {
    const cleanCPF = cpf.replace(/\D/g, "");
    if (cleanCPF.length <= 3) return cleanCPF;
    if (cleanCPF.length <= 6) return `${cleanCPF.slice(0, 3)}.${cleanCPF.slice(3)}`;
    if (cleanCPF.length <= 9) return `${cleanCPF.slice(0, 3)}.${cleanCPF.slice(3, 6)}.${cleanCPF.slice(6)}`;
    return `${cleanCPF.slice(0, 3)}.${cleanCPF.slice(3, 6)}.${cleanCPF.slice(6, 9)}-${cleanCPF.slice(9, 11)}`;
  };

  const formatPhone = (phone: string): string => {
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length <= 2) return cleanPhone;
    if (cleanPhone.length <= 6) return `(${cleanPhone.slice(0, 2)}) ${cleanPhone.slice(2)}`;
    if (cleanPhone.length <= 10) return `(${cleanPhone.slice(0, 2)}) ${cleanPhone.slice(2, 6)}-${cleanPhone.slice(6)}`;
    return `(${cleanPhone.slice(0, 2)}) ${cleanPhone.slice(2, 7)}-${cleanPhone.slice(7, 11)}`;
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof DriverFormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Nome é obrigatório";
    } else if (formData.name.trim().length < 3) {
      newErrors.name = "Nome deve ter pelo menos 3 caracteres";
    }

    if (!formData.cpf.trim()) {
      newErrors.cpf = "CPF é obrigatório";
    } else if (!validateCPF(formData.cpf)) {
      newErrors.cpf = "CPF inválido";
    }

    if (!formData.phone.trim()) {
      newErrors.phone = "Telefone é obrigatório";
    } else {
      const cleanPhone = formData.phone.replace(/\D/g, "");
      if (cleanPhone.length < 10 || cleanPhone.length > 11) {
        newErrors.phone = "Telefone deve ter 10 ou 11 dígitos";
      }
    }

    if (!formData.cnh_number.trim()) {
      newErrors.cnh_number = "Número da CNH é obrigatório";
    } else if (formData.cnh_number.trim().length < 5) {
      newErrors.cnh_number = "Número da CNH deve ter pelo menos 5 caracteres";
    }

    if (!formData.cnh_expiration_date) {
      newErrors.cnh_expiration_date = "Validade da CNH é obrigatória";
    } else {
      const expirationDate = new Date(formData.cnh_expiration_date);
      const today = new Date();
      if (expirationDate <= today) {
        newErrors.cnh_expiration_date = "Validade da CNH deve ser futura";
      }
    }

    if (!formData.access_code?.trim() && !initialData) {
      newErrors.access_code = "Código de acesso é obrigatório";
    } else if (formData.access_code && formData.access_code.length < 4) {
      newErrors.access_code = "Código de acesso deve ter pelo menos 4 caracteres";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof DriverFormData, value: string) => {
    let formattedValue = value;

    if (field === "cpf") {
      formattedValue = formatCPF(value);
    } else if (field === "phone") {
      formattedValue = formatPhone(value);
    } else if (field === "name") {
      formattedValue = value.replace(/[^a-zA-ZÀ-ÿ\s]/g, "");
    } else if (field === "cnh_number") {
      formattedValue = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    }

    setFormData((prev) => ({ ...prev, [field]: formattedValue }));
    
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      if (!initialData) {
        // Reset form for new driver
        setFormData({
          name: "",
          cpf: "",
          phone: "",
          cnh_number: "",
          cnh_category: "B",
          cnh_expiration_date: "",
          status: "ACTIVE",
          access_code: "",
        });
      }
    } catch (error) {
      console.error("Erro ao salvar motorista:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCNHCategoryOptions = () => [
    { value: "A", label: "A - Moto" },
    { value: "B", label: "B - Carro" },
    { value: "C", label: "C - Caminhão" },
    { value: "D", label: "D - Ônibus" },
    { value: "E", label: "E - Carreta" },
  ];

  const getStatusOptions = () => [
    { value: "ACTIVE", label: "Ativo" },
    { value: "INACTIVE", label: "Inativo" },
  ];

  return (
    <form className="driver-form" onSubmit={handleSubmit} noValidate>
      <div className="driver-form-grid">
        <div className="form-group">
          <label htmlFor="driver-name" className="form-label">
            Nome completo <span className="required">*</span>
          </label>
          <input
            id="driver-name"
            type="text"
            placeholder="Digite o nome completo"
            value={formData.name}
            onChange={(e) => handleInputChange("name", e.target.value)}
            className={`form-input ${errors.name ? "error" : ""}`}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "name-error" : undefined}
            maxLength={100}
            autoComplete="name"
          />
          {errors.name && (
            <span id="name-error" className="error-message" role="alert">
              {errors.name}
            </span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="driver-cpf" className="form-label">
            CPF <span className="required">*</span>
          </label>
          <input
            id="driver-cpf"
            type="text"
            placeholder="000.000.000-00"
            value={formData.cpf}
            onChange={(e) => handleInputChange("cpf", e.target.value)}
            className={`form-input ${errors.cpf ? "error" : ""}`}
            aria-invalid={!!errors.cpf}
            aria-describedby={errors.cpf ? "cpf-error" : undefined}
            maxLength={14}
            autoComplete="off"
          />
          {errors.cpf && (
            <span id="cpf-error" className="error-message" role="alert">
              {errors.cpf}
            </span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="driver-phone" className="form-label">
            Telefone <span className="required">*</span>
          </label>
          <input
            id="driver-phone"
            type="tel"
            placeholder="(00) 00000-0000"
            value={formData.phone}
            onChange={(e) => handleInputChange("phone", e.target.value)}
            className={`form-input ${errors.phone ? "error" : ""}`}
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? "phone-error" : undefined}
            maxLength={15}
            autoComplete="tel"
          />
          {errors.phone && (
            <span id="phone-error" className="error-message" role="alert">
              {errors.phone}
            </span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="driver-cnh-number" className="form-label">
            Número da CNH <span className="required">*</span>
          </label>
          <input
            id="driver-cnh-number"
            type="text"
            placeholder="Digite o número da CNH"
            value={formData.cnh_number}
            onChange={(e) => handleInputChange("cnh_number", e.target.value)}
            className={`form-input ${errors.cnh_number ? "error" : ""}`}
            aria-invalid={!!errors.cnh_number}
            aria-describedby={errors.cnh_number ? "cnh-number-error" : undefined}
            maxLength={20}
            autoComplete="off"
          />
          {errors.cnh_number && (
            <span id="cnh-number-error" className="error-message" role="alert">
              {errors.cnh_number}
            </span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="driver-cnh-category" className="form-label">
            Categoria da CNH <span className="required">*</span>
          </label>
          <select
            id="driver-cnh-category"
            value={formData.cnh_category}
            onChange={(e) => setFormData((prev) => ({ ...prev, cnh_category: e.target.value }))}
            className="form-select"
            aria-label="Categoria da CNH"
          >
            {getCNHCategoryOptions().map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="driver-cnh-expiration" className="form-label">
            Validade da CNH <span className="required">*</span>
          </label>
          <input
            id="driver-cnh-expiration"
            type="date"
            value={formData.cnh_expiration_date}
            onChange={(e) => setFormData((prev) => ({ ...prev, cnh_expiration_date: e.target.value }))}
            className={`form-input ${errors.cnh_expiration_date ? "error" : ""}`}
            aria-invalid={!!errors.cnh_expiration_date}
            aria-describedby={errors.cnh_expiration_date ? "cnh-expiration-error" : undefined}
            min={new Date().toISOString().split("T")[0]}
          />
          {errors.cnh_expiration_date && (
            <span id="cnh-expiration-error" className="error-message" role="alert">
              {errors.cnh_expiration_date}
            </span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="driver-status" className="form-label">
            Status <span className="required">*</span>
          </label>
          <select
            id="driver-status"
            value={formData.status}
            onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as "ACTIVE" | "INACTIVE" }))}
            className="form-select"
            aria-label="Status do motorista"
          >
            {getStatusOptions().map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="driver-access-code" className="form-label">
            Código de Acesso {!initialData && <span className="required">*</span>}
          </label>
          <input
            id="driver-access-code"
            type="text"
            placeholder="Digite o código de acesso"
            value={formData.access_code}
            onChange={(e) => setFormData((prev) => ({ ...prev, access_code: e.target.value }))}
            className={`form-input ${errors.access_code ? "error" : ""}`}
            aria-invalid={!!errors.access_code}
            aria-describedby={errors.access_code ? "access-code-error" : undefined}
            maxLength={20}
            autoComplete="off"
          />
          {errors.access_code && (
            <span id="access-code-error" className="error-message" role="alert">
              {errors.access_code}
            </span>
          )}
        </div>
      </div>

      <div className="driver-form-actions">
        <button
          type="submit"
          className="driver-submit-button"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <span className="loading-spinner" aria-hidden="true"></span>
              Salvando...
            </>
          ) : (
            initialData ? "Atualizar Motorista" : "Cadastrar Motorista"
          )}
        </button>
        {onCancel && (
          <button
            type="button"
            className="driver-cancel-button"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
};