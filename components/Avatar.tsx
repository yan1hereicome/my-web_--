export function initials(name: string) {
  return name.split(" ").map((w) => w[0]?.toUpperCase() ?? "").slice(0, 2).join("") || "?";
}

export default function Avatar({ name, url, size = "md" }: { name: string; url?: string | null; size?: "sm" | "md" | "lg" }) {
  const dims = size === "sm" ? "w-6 h-6 text-[10px]" : size === "lg" ? "w-16 h-16 text-xl" : "w-8 h-8 text-xs";
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className={`${dims} rounded-full object-cover flex-shrink-0`} />;
  }
  return (
    <div className={`${dims} rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold flex-shrink-0`}>
      {initials(name)}
    </div>
  );
}
