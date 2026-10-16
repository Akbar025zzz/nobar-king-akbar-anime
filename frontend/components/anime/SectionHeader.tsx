import Link from "next/link";

interface SectionHeaderProps {
  kicker?: string;
  title: string;
  href?: string;
  linkLabel?: string;
  description?: string;
}

export function SectionHeader({ kicker, title, href, linkLabel = "Lihat semua", description }: SectionHeaderProps) {
  return (
    <div className="section-heading">
      <div>
        {kicker ? <p className="section-kicker">{kicker}</p> : null}
        <h2 className="section-title mt-1.5">{title}</h2>
        {description ? <p className="mt-1.5 text-sm text-fog-500">{description}</p> : null}
      </div>
      {href ? (
        <Link
          href={href}
          className="shrink-0 text-xs font-semibold text-accent-400 transition-colors hover:text-accent-300"
        >
          {linkLabel} →
        </Link>
      ) : null}
    </div>
  );
}
