import { initials } from "@/lib/format";

interface AvatarProps {
  name: string;
  color?: string | null;
  size?: "sm" | "md" | "lg";
  ring?: boolean;
  title?: string;
}

const sizeClasses: Record<NonNullable<AvatarProps["size"]>, string> = {
  sm: "h-7 w-7 text-[10px]",
  md: "h-9 w-9 text-xs",
  lg: "h-12 w-12 text-sm",
};

export function Avatar({ name, color, size = "md", ring = false, title }: AvatarProps) {
  const background = color ?? "#55CBD8";
  return (
    <span
      title={title ?? name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold uppercase text-ink-950 ${sizeClasses[size]} ${
        ring ? "ring-2 ring-ink-950" : ""
      }`}
      style={{
        background: `linear-gradient(180deg, ${background}, ${background}cc)`,
        boxShadow: `0 6px 18px -8px ${background}aa`,
      }}
    >
      {initials(name || "?")}
    </span>
  );
}
