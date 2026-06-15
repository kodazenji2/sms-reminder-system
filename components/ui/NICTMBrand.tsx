import Image from "next/image";

export function NICTMBrand({ inverted = false }: { inverted?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0">
        <Image
          src="/nictm_logo.jpg"
          alt="NICTM Logo"
          width={45}
          height={45}
          className="rounded-full object-cover"
        />
      </div>
      <div />
    </div>
  );
}
