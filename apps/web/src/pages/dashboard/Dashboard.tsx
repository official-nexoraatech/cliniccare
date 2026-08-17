import { useAuthStore } from '@/store/auth-store';

const cards = [
  { label: "Today's Patients", value: '0' },
  { label: 'Collection Today', value: '₹0' },
  { label: 'Appointments Today', value: '0' },
  { label: 'Follow-ups Due', value: '0' },
];

export function Dashboard() {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-navy)]">
          Welcome back, {user?.name?.split(' ')[0] ?? 'there'}
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              {card.label}
            </p>
            <p className="mt-2 text-2xl font-bold text-[var(--color-navy)]">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
