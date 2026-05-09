# Demandas Elétrica Paraná — App PWA

PWA para vendedores da Elétrica Paraná registrarem demandas de produtos
**em falta** ou **não cadastrados** no momento do atendimento, e gerar relatório
semanal automático para o setor de Compras.

> Especificação completa: [`../prompt-claude-code-app-eletrica-parana.md`](../prompt-claude-code-app-eletrica-parana.md)

## Status atual

Etapas concluídas (ver "Ordem de execução" no documento de especificação):

- [x] **1.** Setup Next.js 14 + TypeScript + Tailwind + Serwist (PWA)
- [x] **2.** Schema Supabase + RLS (migrations `supabase/migrations/0001_init.sql`, `0002_add_sap_code.sql`) + seed do catálogo WEG (~12.8k produtos)
- [x] **3.** Auth (login por e-mail/senha + middleware de proteção de rotas)
- [ ] **4.** Tela principal + formulário de registro ⏸ aguardando confirmação
- [ ] 5–12. Sincronização offline, histórico, painel admin, PDF, e-mail, deploy

A próxima etapa precisa ser validada com tela real antes de prosseguir
(ver final do prompt original).

## Stack

| Camada       | Tecnologia                                              |
| ------------ | ------------------------------------------------------- |
| Frontend     | Next.js 14 (App Router) · TypeScript · Tailwind CSS     |
| PWA          | Serwist (`@serwist/next`) — service worker + precache   |
| Backend / DB | Supabase (Postgres + Auth + Storage)                    |
| Offline      | Dexie.js + IndexedDB *(integração na etapa 5)*          |
| PDF          | react-pdf *(etapa 8)*                                   |
| E-mail       | Resend *(etapa 9, via Supabase Edge Function)*          |
| Hospedagem   | Vercel                                                  |

## Pré-requisitos

- Node.js ≥ 20
- Conta Supabase (qualquer plano, free atende)
- (Opcional, etapa 9) Conta Resend para envio de e-mail

## Setup local

```bash
cd eletrica-parana-app
npm install
cp .env.example .env.local   # preencher chaves do Supabase
npm run dev
```

Abra http://localhost:3000.

### Variáveis de ambiente

Veja `.env.example`. As três da Supabase são obrigatórias para o login funcionar:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### Aplicar a migration no Supabase

Opção A — **CLI Supabase** (recomendado):

```bash
npx supabase link --project-ref <seu-project-ref>
npx supabase db push
```

Opção B — **SQL Editor do dashboard**: copie o conteúdo de
`supabase/migrations/0001_init.sql` e execute no SQL Editor do projeto.

### Criar o admin inicial

1. Em Supabase Dashboard → Authentication → Users → **Add user** (e-mail + senha).
2. Execute no SQL Editor (substituindo o e-mail):

   ```sql
   update public.profiles
      set role = 'admin', full_name = 'Administrador'
    where id = (select id from auth.users
                 where email = 'admin@eletricaparana.com.br');
   ```

3. (Opcional) Defina os destinatários do relatório:

   ```sql
   update public.report_config
      set recipients = array['compras@eletricaparana.com.br'];
   ```

   Veja também `supabase/seed.sql`.

### Carregar o catálogo WEG (~12.800 produtos)

Pré-requisito: `.env.local` com `NEXT_PUBLIC_SUPABASE_URL` e
`SUPABASE_SERVICE_ROLE_KEY` preenchidos, e a migration `0002_add_sap_code.sql`
aplicada.

```bash
npm run seed:weg
```

O script faz upsert em batches de 1000 produtos por sap_code (idempotente —
pode rodar várias vezes). O JSON-fonte está em `data/weg-products.json`.

Para regenerar o JSON a partir de uma nova lista de preços WEG:

```bash
npm run extract:weg -- ../Lista_de_Precos_NOVA.xlsm
```

Estrutura assumida do Excel:
- Coluna A = Código SAP (8 dígitos)
- Coluna B = Família
- Coluna C = Descrição SAP

Sheets esperadas: CONTROLS, DRIVES, SENSORES E SEGURANÇA, CRITICAL POWER.

## Estrutura do projeto

```
eletrica-parana-app/
├── app/
│   ├── (auth)/login/         # tela de login + form client-side
│   ├── (vendor)/dashboard/   # tela principal (placeholder p/ etapa 4)
│   ├── layout.tsx
│   ├── page.tsx              # redireciona p/ /login ou /dashboard
│   ├── sw.ts                 # service worker (Serwist)
│   └── globals.css
├── components/
│   ├── auth/logout-button.tsx
│   └── pwa/install-prompt.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts         # browser client
│   │   ├── server.ts         # RSC server client
│   │   ├── middleware.ts     # refresh de sessão + redirects
│   │   └── types.ts          # tipos manuais (regerar c/ supabase gen)
│   └── utils.ts
├── middleware.ts             # entrypoint do middleware Next.js
├── public/
│   ├── icons/                # ícones PWA (placeholder "EP")
│   └── manifest.json
├── supabase/
│   ├── migrations/0001_init.sql
│   └── seed.sql
├── next.config.mjs           # com @serwist/next
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Modelo de dados (resumo)

- `profiles` — estende `auth.users` com `role` (vendedor / admin / compras),
  `branch`, `phone`. Trigger cria profile automaticamente no signup.
- `products` — catálogo crescente, alimentado pelos registros. Coluna
  `normalized_name` (gerada) p/ busca sem acento.
- `customers` — idem para clientes.
- `demand_records` — tabela principal. Coluna `client_uuid` única para
  deduplicação na sincronização offline (etapa 5).
- `report_config` — singleton com destinatários e horário do envio semanal.

### RLS

- Vendedor vê e edita só os próprios `demand_records`, e só dentro de 24h após criação.
- Admin/Compras veem tudo.
- Catálogos (`products`, `customers`) são leitura/inserção para qualquer
  autenticado; só staff atualiza/exclui (limpeza de duplicatas).
- `report_config` só staff.

### Storage

Bucket privado `demand-photos` criado pela migration. Upload restrito a
usuários autenticados.

## PWA

- `public/manifest.json` configurado (instalável Android/iOS).
- Service worker via Serwist (`app/sw.ts` → `public/sw.js` no build).
- Botão "Instalar app" aparece quando o navegador dispara `beforeinstallprompt`.
- Ícones em `public/icons/` são **placeholders** ("EP" branco em fundo azul).
  Substituir pelo logo oficial da Elétrica Paraná antes do deploy.

## Scripts

```bash
npm run dev        # Next.js dev (service worker desabilitado)
npm run build      # build de produção (gera o sw.js)
npm run start      # serve build
npm run typecheck  # tsc --noEmit
npm run lint       # next lint
```

## Próxima etapa (4 — formulário de registro)

Campos definidos no prompt; UX otimizada para ≤20s. Implementar em
`app/(vendor)/registrar/` reusando o cliente Supabase. **Validar a UX em
celular real antes de prosseguir.**
