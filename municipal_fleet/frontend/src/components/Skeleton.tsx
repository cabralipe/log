import "./Skeleton.css";

type SkeletonProps = {
  className?: string;
  width?: string | number;
  height?: string | number;
  variant?: "text" | "circular" | "rectangular";
};

export const Skeleton = ({
  className = "",
  width,
  height,
  variant = "text",
}: SkeletonProps) => {
  const style = {
    width,
    height,
  };

  return (
    <div
      className={`skeleton ${variant} ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
};
