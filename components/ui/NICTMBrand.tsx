import Image from "next/image";

export function NICTMBrand({ inverted = false }: { inverted?: boolean }) {
  return (
    <Image
      src="/nictm_logo.jpg"
      alt="NICTM Logo"
      width={96}
      height={96}
      className="rounded-full object-cover"
    />
  );
}
