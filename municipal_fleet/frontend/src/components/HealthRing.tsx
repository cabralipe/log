import React from "react";
import "./HealthRing.css";

type HealthRingProps = {
    value: number; // 0 to 100
    size?: number;
    strokeWidth?: number;
    icon?: React.ReactNode;
    color?: "success" | "warning" | "danger" | "info";
    pulsing?: boolean;
};

export const HealthRing = ({
    value,
    size = 60,
    strokeWidth = 4,
    icon,
    color = "success",
    pulsing = false,
}: HealthRingProps) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (value / 100) * circumference;

    return (
        <div className={`health-ring-container ${pulsing ? "pulsing" : ""}`} style={{ width: size, height: size }}>
            <svg width={size} height={size} className="health-ring-svg">
                <circle
                    className="health-ring-bg"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
                <circle
                    className={`health-ring-progress ${color}`}
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                    style={{
                        strokeDasharray: circumference,
                        strokeDashoffset: offset,
                    }}
                />
            </svg>
            {icon && <div className="health-ring-icon">{icon}</div>}
        </div>
    );
};
