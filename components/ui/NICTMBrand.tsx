import Image from "next/image";

interface NICTMBrandProps {
  inverted?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<NICTMBrandProps["size"]>, string> = {
  sm: "w-9 h-9 md:w-10 md:h-10",      // nav bars (lecturer/admin)
  md: "w-14 h-14 md:w-16 md:h-16",    // dashboards, cards
  lg: "w-20 h-20 md:w-28 md:h-28",    // login / landing page
};

export function NICTMBrand({ inverted = false, size = "md", className = "" }: NICTMBrandProps) {
  return (
    <Image
      src="/NICTM LOGO.jpg"
      alt="NICTM Logo"
      width={160}
      height={160}
      priority
      className={`rounded-full object-cover flex-shrink-0 ${SIZE_CLASSES[size]} ${className}`}
    />
  );
}
