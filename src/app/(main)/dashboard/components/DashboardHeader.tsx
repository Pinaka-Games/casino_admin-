export default function DashboardHeader({ title }: { title: string }) {
  return (
    <div className="w-full bg-[#191D24] px-6 py-2 flex items-center rounded-md">
      <h1 className="text-white text-xl font-normal">{title}</h1>
    </div>
  );
}
