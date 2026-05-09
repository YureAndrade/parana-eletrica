import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/auth/logout-button";

export const metadata = { title: "Início — Demandas Elétrica Paraná" };

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, branch")
    .eq("id", user.id)
    .single();

  const nome = profile?.full_name ?? user.email;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pt-[calc(var(--safe-top)+1rem)] pb-[calc(var(--safe-bottom)+1rem)]">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Olá,
          </p>
          <h1 className="text-lg font-semibold text-slate-900">{nome}</h1>
          {profile?.branch && (
            <p className="text-xs text-slate-500">Filial: {profile.branch}</p>
          )}
        </div>
        <LogoutButton />
      </header>

      <section className="mt-2 flex flex-1 flex-col items-center justify-center gap-6">
        <button
          type="button"
          className="flex h-44 w-44 flex-col items-center justify-center rounded-full bg-brand text-white shadow-lg transition active:scale-95 disabled:opacity-60"
          disabled
          aria-label="Registrar demanda (em breve)"
        >
          <span className="text-5xl">+</span>
          <span className="mt-1 text-base font-semibold">Registrar</span>
          <span className="text-xs opacity-80">demanda</span>
        </button>

        <p className="max-w-xs text-center text-sm text-slate-500">
          Botão de registro será habilitado na próxima etapa (formulário).
        </p>
      </section>

      <footer className="mt-6 text-center text-xs text-slate-400">
        v0.1 · {profile?.role ?? "vendedor"}
      </footer>
    </main>
  );
}
