# Prompt para Claude Code — App "Demandas Não Atendidas" Elétrica Paraná

## Contexto do negócio

A **Elétrica Paraná** é uma revenda integrada WEG. Vendedores frequentemente recebem pedidos de clientes para itens que **não temos em estoque** ou que **nem estão cadastrados em nosso sistema**. Hoje essa informação se perde: o vendedor diz "não tenho" e o cliente vai embora. O setor de Compras nunca fica sabendo que existe demanda recorrente para esses produtos, e perdemos vendas que poderiam virar giro.

**Objetivo do app:** capturar essa demanda perdida em tempo real, no momento em que ela acontece, e entregar ao Compras um relatório semanal acionável.

## Stack obrigatória

Construa como **PWA (Progressive Web App)** — não app nativo. Justificativas:
- Vendedor instala via navegador (sem Play Store/App Store)
- Atualização instantânea para todos os usuários
- Funciona offline (essencial: vendedor pode estar em depósito sem sinal)
- Um único código para Android e iOS
- Custo de manutenção 80% menor

**Stack recomendada:**
- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **PWA:** next-pwa (service worker, manifest, instalável)
- **Backend/DB:** Supabase (PostgreSQL + Auth + Storage para fotos) — plano gratuito atende
- **Offline-first:** IndexedDB via Dexie.js, sincronização quando a conexão volta
- **Geração de PDF:** react-pdf ou Puppeteer no backend
- **Envio de e-mail:** Resend ou Supabase Edge Functions + SMTP
- **Hospedagem:** Vercel (gratuito, deploy automático via GitHub)

## Princípio de UX inegociável

**Cada registro deve ser concluído pelo vendedor em menos de 20 segundos.** Se a UX exigir mais cliques, mais campos ou mais espera, o vendedor não vai usar. Otimize tudo para uma mão, polegar, em pé, com cliente esperando.

## Funcionalidades — MVP (entregar nesta ordem)

### 1. Autenticação simples
- Login por e-mail + senha (Supabase Auth)
- Cadastro inicial feito pelo admin (não auto-cadastro)
- Cada vendedor tem perfil: nome, e-mail, telefone, filial/loja
- Persistência de sessão por 90 dias (vendedor não digita senha toda vez)

### 2. Tela principal: "Registrar demanda"
Botão grande no centro da tela, único CTA. Ao tocar, abre o formulário:

**Campos do formulário (nesta ordem, por prioridade de preenchimento):**

| Campo | Tipo | Obrigatório | Detalhes |
|---|---|---|---|
| Produto solicitado | Texto livre + autocomplete | Sim | Sugere produtos já registrados antes (qualquer vendedor); permite criar novo |
| Marca/Fabricante | Select com opção "Outros" | Não | Lista: WEG, BRG, Dancor, Megatron, Outros |
| Status | Toggle | Sim | "Em falta" ou "Não cadastrado" (default: Em falta) |
| Cliente | Texto livre + autocomplete | Sim | Sugere clientes já registrados; permite criar novo |
| Quantidade pedida | Número | Não | Default: 1 |
| Observação | Texto livre + ditado por voz | Não | Web Speech API para ditar |
| Foto | Upload da câmera | Não | Comprime para ≤500KB antes de enviar |
| Data/hora | Auto | Sim | Capturada automaticamente |
| Vendedor | Auto | Sim | Do login |

**Botão "Salvar" único e grande no rodapé.** Após salvar, mostrar toast de confirmação por 2s e voltar para a tela principal pronta para o próximo registro.

### 3. Histórico do vendedor
Aba secundária: lista dos últimos 30 registros do próprio vendedor, com filtro por data e busca por produto. Cada item mostra: produto, cliente, data, status. Toque longo permite editar (até 24h após criação) ou excluir.

### 4. Painel admin (web, mesmo app, rota protegida)
Acesso apenas para perfis com role "admin" ou "compras":
- Dashboard com totais da semana: nº de demandas, top 10 produtos mais pedidos, top 5 clientes que mais geraram demanda, distribuição por vendedor
- Tabela completa de registros com filtros (período, vendedor, produto, status, marca)
- Exportação manual em PDF e Excel
- Gestão de usuários (criar/desativar vendedor)
- Gestão da lista mestra de produtos e clientes (limpar duplicatas, padronizar nomes)

### 5. Relatório semanal automático ⭐ (prioridade alta — é o entregável que justifica o app)
**Geração automática toda segunda-feira às 7h da manhã, cobrindo a semana anterior (segunda a domingo).**

Conteúdo do relatório (PDF):
- **Capa:** logo Elétrica Paraná, período, total de demandas registradas
- **Resumo executivo:** nº de produtos únicos pedidos, nº de clientes impactados, nº de vendedores ativos no registro
- **Seção 1 — Top produtos por frequência:** tabela ordenada por nº de pedidos, com colunas: produto, marca, status (em falta/não cadastrado), nº de pedidos, quantidade total solicitada, clientes únicos, vendedores que registraram
- **Seção 2 — Detalhamento por produto:** para cada produto do top 20, listar os clientes que pediram com data e quantidade
- **Seção 3 — Produtos "não cadastrados":** seção separada e destacada — são oportunidades de novos itens no portfólio
- **Seção 4 — Anexo:** lista bruta de todos os registros da semana

**Envio automático:** e-mail para lista configurável de destinatários (Compras + gestores), com PDF anexo e link para painel web.

### 6. Notificações push (opcional — fase 2)
- Lembrete diário às 17h se o vendedor não registrou nada no dia
- Notificação para Compras quando algum produto atinge 5+ pedidos na semana

## Modelo de dados (Supabase / PostgreSQL)

```sql
-- Usuários (estende auth.users do Supabase)
profiles (
  id uuid PK references auth.users,
  full_name text not null,
  phone text,
  branch text, -- filial/loja
  role text check (role in ('vendedor','admin','compras')) default 'vendedor',
  active boolean default true,
  created_at timestamptz default now()
)

-- Catálogo crescente de produtos (auto-alimentado)
products (
  id uuid PK,
  name text not null,
  brand text,
  normalized_name text generated, -- lowercase, sem acentos, p/ busca
  first_requested_at timestamptz,
  request_count int default 0, -- denormalizado p/ ordenação rápida
  created_by uuid references profiles
)

-- Catálogo crescente de clientes
customers (
  id uuid PK,
  name text not null,
  phone text,
  document text, -- CPF/CNPJ opcional
  normalized_name text generated,
  created_by uuid references profiles,
  created_at timestamptz default now()
)

-- Registros de demanda (tabela principal)
demand_records (
  id uuid PK,
  product_id uuid references products,
  customer_id uuid references customers,
  vendor_id uuid references profiles,
  quantity int default 1,
  status text check (status in ('out_of_stock','not_registered')) not null,
  notes text,
  photo_url text,
  client_uuid text, -- ID gerado offline para deduplicação
  created_at timestamptz default now(),
  synced_at timestamptz -- quando saiu do offline
)

-- Configuração de envio do relatório
report_config (
  id uuid PK,
  recipients text[], -- e-mails
  send_day int default 1, -- 1=segunda
  send_hour int default 7,
  active boolean default true
)
```

**Índices essenciais:**
- `demand_records (created_at desc)`
- `demand_records (vendor_id, created_at desc)`
- `demand_records (product_id)`
- `products (normalized_name)` para busca rápida
- `customers (normalized_name)` para busca rápida

**RLS (Row Level Security) Supabase:**
- Vendedor só vê e edita seus próprios registros (≤24h)
- Admin/Compras veem tudo

## Fluxo offline-first

1. Vendedor abre o app sem internet
2. Registro é salvo em IndexedDB (Dexie) com `client_uuid` gerado localmente
3. UI mostra ícone de "pendente sincronizar"
4. Quando a conexão volta, service worker dispara sync em background
5. Conflitos: server is source of truth para dados de catálogo, cliente local sempre vence para registros novos

## Critérios de aceite do MVP

- [ ] Vendedor consegue registrar uma demanda completa em ≤20s (medir com cronômetro real)
- [ ] App funciona 100% offline para registro; sincroniza ao reconectar
- [ ] PDF do relatório semanal é gerado e enviado por e-mail automaticamente toda segunda 7h
- [ ] Painel admin permite filtrar e exportar a qualquer momento
- [ ] Lighthouse PWA score ≥ 90
- [ ] App é instalável no celular (Android e iOS) via prompt do navegador
- [ ] Zero dependência de loja de aplicativos

## Estrutura de pastas sugerida

```
eletrica-parana-app/
├── app/
│   ├── (auth)/login/
│   ├── (vendor)/dashboard/
│   ├── (vendor)/registrar/
│   ├── (vendor)/historico/
│   ├── (admin)/painel/
│   ├── api/reports/weekly/route.ts
│   └── layout.tsx
├── components/
│   ├── forms/DemandForm.tsx
│   ├── ui/ (shadcn)
│   └── pwa/InstallPrompt.tsx
├── lib/
│   ├── supabase/
│   ├── db/dexie.ts (offline)
│   ├── sync/syncEngine.ts
│   └── reports/pdfGenerator.tsx
├── public/
│   ├── manifest.json
│   ├── icons/ (192, 512, maskable)
│   └── sw.js
└── supabase/
    └── migrations/
```

## Variáveis de ambiente necessárias

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
REPORT_FROM_EMAIL=
APP_URL=
```

## Ordem de execução

1. **Setup:** Next.js + TypeScript + Tailwind + shadcn + next-pwa
2. **Supabase:** projeto, schema, RLS, seed de admin inicial
3. **Auth:** tela de login + middleware de proteção de rotas
4. **Tela principal + formulário de registro** (foco em UX)
5. **Sincronização offline** com Dexie + service worker
6. **Histórico do vendedor**
7. **Painel admin** com dashboard e filtros
8. **Geração de PDF** do relatório
9. **Edge Function** para envio automático semanal (cron)
10. **Polimento PWA:** ícones, manifest, install prompt, splash screens
11. **Deploy** Vercel + configuração de domínio
12. **Onboarding:** documentação curta para vendedores (1 página com prints)

## Não fazer (escopo fora do MVP)

- ❌ Integração com ERP/sistema de estoque atual (fase 2 — exige levantamento)
- ❌ Cotação automática com fornecedores
- ❌ Comissionamento ou gamificação
- ❌ Chat interno entre vendedor e Compras
- ❌ Versão nativa (iOS/Android)

## Entregáveis finais

1. Repositório Git com README detalhado de instalação
2. App em produção na Vercel com domínio configurável
3. Projeto Supabase configurado e populado com schema
4. Documento de 1 página para vendedores: como instalar o app no celular e como registrar uma demanda
5. Documento técnico para o admin: como adicionar novos vendedores, configurar destinatários do relatório e exportar dados

---

**Comece pela etapa 1 e me peça confirmação antes de avançar para a etapa 4 (formulário de registro). É o ponto onde a UX precisa ser validada com tela real antes de seguir.**
