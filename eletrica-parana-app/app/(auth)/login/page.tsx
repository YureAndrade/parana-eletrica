import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar — Demandas Elétrica Paraná" };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 pt-[var(--safe-top)] pb-[var(--safe-bottom)]">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-2xl font-bold text-white shadow-md">
            EP
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            Demandas Elétrica Paraná
          </h1>
          <p className="text-sm text-slate-500">
            Acesso restrito a vendedores cadastrados.
          </p>
        </div>

        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
