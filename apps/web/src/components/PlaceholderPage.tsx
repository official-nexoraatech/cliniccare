interface PlaceholderPageProps {
  title: string;
  day: string;
}

export function PlaceholderPage({ title, day }: PlaceholderPageProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-20 text-center">
      <h1 className="text-xl font-semibold text-[var(--color-navy)]">{title}</h1>
      <p className="mt-2 text-sm text-gray-400">Scheduled for {day} of the build plan — not built yet.</p>
    </div>
  );
}
