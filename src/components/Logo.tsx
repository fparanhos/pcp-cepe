/* eslint-disable @next/next/no-img-element */
export function Logo({ size = 40, mono = false }: { size?: number; mono?: boolean }) {
  return (
    <img
      src="/logo.png"
      alt="CEPE"
      width={size}
      height={size}
      style={{
        height: size,
        width: 'auto',
        objectFit: 'contain',
        filter: mono ? 'brightness(0) invert(1)' : undefined,
      }}
    />
  );
}
