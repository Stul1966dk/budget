import { NavBar } from "./NavBar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <NavBar />
      <main className="flex-1 pb-20 sm:pb-8">{children}</main>
    </div>
  );
}
