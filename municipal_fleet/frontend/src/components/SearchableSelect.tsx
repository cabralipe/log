import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import "./SearchableSelect.css";

type Option = {
    value: number | string;
    label: string;
};

type SearchableSelectProps = {
    options: Option[];
    value: number | string | null | undefined;
    onChange: (value: number | string) => void;
    placeholder?: string;
    required?: boolean;
};

export const SearchableSelect = ({
    options,
    value,
    onChange,
    placeholder = "Selecione...",
    required = false
}: SearchableSelectProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const selectedOption = useMemo(
        () => options.find((opt) => opt.value === value),
        [options, value]
    );

    const filteredOptions = useMemo(
        () =>
            options.filter((opt) =>
                opt.label.toLowerCase().includes(searchTerm.toLowerCase())
            ),
        [options, searchTerm]
    );

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Focus search input when opened
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isOpen]);

    // Reset search when closed
    useEffect(() => {
        if (!isOpen) setSearchTerm("");
    }, [isOpen]);

    const handleSelect = (val: number | string) => {
        onChange(val);
        setIsOpen(false);
    };

    return (
        <div className="searchable-select" ref={containerRef}>
            <div
                className={`searchable-select__control ${isOpen ? "open" : ""}`}
                onClick={() => setIsOpen(!isOpen)}
                role="combobox"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                {selectedOption ? (
                    <span className="searchable-select__value">{selectedOption.label}</span>
                ) : (
                    <span className="searchable-select__placeholder">{placeholder}</span>
                )}
                <ChevronDown size={16} className="searchable-select__arrow" />
            </div>

            {isOpen && (
                <div className="searchable-select__dropdown">
                    <div className="searchable-select__search">
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                    <ul className="searchable-select__options" role="listbox">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt) => (
                                <li
                                    key={opt.value}
                                    className={`searchable-select__option ${opt.value === value ? "selected" : ""
                                        }`}
                                    onClick={() => handleSelect(opt.value)}
                                    role="option"
                                    aria-selected={opt.value === value}
                                >
                                    {opt.label}
                                </li>
                            ))
                        ) : (
                            <div className="searchable-select__empty">Sem resultados.</div>
                        )}
                    </ul>
                </div>
            )}

            {required && (
                <input
                    tabIndex={-1}
                    autoComplete="off"
                    style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                    value={value || ""}
                    required={required}
                    onChange={() => { }}
                />
            )}
        </div>
    );
};
