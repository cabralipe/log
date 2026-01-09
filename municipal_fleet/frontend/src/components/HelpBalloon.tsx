import { HelpCircle } from "lucide-react";
import "./HelpBalloon.css";

type HelpBalloonProps = {
    title: string;
    description: string;
    learnMoreUrl?: string;
};

export const HelpBalloon = ({ title, description, learnMoreUrl }: HelpBalloonProps) => {
    return (
        <div className="help-balloon" aria-label={title}>
            <HelpCircle size={16} />
            <div className="help-balloon__content">
                <span className="help-balloon__title">{title}</span>
                <p className="help-balloon__desc">{description}</p>
                {learnMoreUrl && (
                    <a href={learnMoreUrl} target="_blank" rel="noopener noreferrer" className="help-balloon__link">
                        Saiba mais &rarr;
                    </a>
                )}
            </div>
        </div>
    );
};
