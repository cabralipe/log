import React from "react";
import "./TrendLabel.css";

type TrendLabelProps = {
    value: number; // Percentage change, e.g., 12 for +12%
    label?: string; // e.g., "vs last month"
    inverse?: boolean; // If true, positive is bad (e.g., costs)
};

export const TrendLabel = ({ value, label, inverse = false }: TrendLabelProps) => {
    const isPositive = value > 0;
    const isNeutral = value === 0;

    // Determine color logic
    // Standard: Positive = Good (Green), Negative = Bad (Red)
    // Inverse: Positive = Bad (Red), Negative = Good (Green)
    let status = "neutral";
    if (!isNeutral) {
        if (inverse) {
            status = isPositive ? "danger" : "success";
        } else {
            status = isPositive ? "success" : "danger";
        }
    }

    const formattedValue = isNeutral ? "0%" : `${isPositive ? "+" : ""}${value}%`;

    return (
        <div className={`trend-label ${status}`}>
            <span className="trend-value">{formattedValue}</span>
            {label && <span className="trend-text">{label}</span>}
        </div>
    );
};
