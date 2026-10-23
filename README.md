# Doses PS: site público + administração segura

Projeto Supabase já criado e configurado: **doses-ps** (São Paulo). Banco, regras de acesso e `config.js` já estão prontos.

## Arquivos
- `index.html`, `styles.css`, `app.js`: app público (somente leitura).
- `data/drugs.json`: dados iniciais e cópia offline.
- `admin.html`, `admin.js`: painel (login + 2º fator + aprovação dupla).
- `schema.sql`: referência do que já foi aplicado no banco.
- `_headers`: cabeçalhos de segurança (CSP, HSTS) para Cloudflare Pages ou Netlify.
- `sw.js`, `manifest.webmanifest`, `icon.svg`: instalação no celular e uso offline.

## O que falta fazer (só você consegue)
1. No painel do Supabase (Authentication > Sign In / Providers > Email): **mantenha o cadastro ligado** (os usuários criam conta) e **ative "Confirm email"**. Rode `supabase/migrations/usuarios_premium.sql` no SQL Editor (leia o passo 0 do arquivo).
2. Em Authentication > Multi-Factor, ative **TOTP**.
3. Em Authentication > Users > Add user, crie o administrador (senha longa). Depois, no SQL Editor:
   `insert into public.profiles(id) select id from auth.users where email='SEU@EMAIL';`
4. Publique esta pasta no **Cloudflare Pages** (Upload direto) ou **Netlify Drop**; HTTPS e `_headers` funcionam sozinhos.
5. Abra `/admin.html`, entre, ative o 2º fator, clique em **Enviar alterações** para publicar os dados iniciais.
6. Crie o 2º administrador (repita o passo 3) e **ligue a aprovação dupla**:
   `update public.app_config set value=true where key='require_approval';`

## Como funciona a aprovação dupla
- Quem edita clica em "Enviar alterações". Com a aprovação ligada, a mudança fica pendente.
- Outro administrador abre "Aprovações", vê o que mudou (campo antes → depois) e aprova ou recusa.
- Quem enviou não pode aprovar a própria mudança. Cada versão fica no Histórico e pode ser restaurada.
- Enquanto a aprovação estiver desligada (estado inicial), um único admin publica direto.

## O que protege
- Público só lê. Escrever exige: estar em `profiles` + senha + 2º fator, validado no servidor.
- Ninguém altera `content` direto: só pelas funções `submit_change` e `review_change`.
- Edição concorrente bloqueada por versão. CSP bloqueia scripts externos. Nenhum dado de paciente é guardado.

## Limites
- Nenhum sistema é invulnerável: poucos admins, todos com 2º fator.
- Baixe `supabase.min.js` e hospede junto para tirar a CDN do `admin.html` e do CSP.
- iPhone: adicione um `apple-touch-icon` PNG 180x180.
- As doses precisam de validação clínica (farmácia/coordenação médica) antes do uso real.

## Contas, premium e pagamento
- Gratuito (sem conta): Doses adulto e Doses pediátricas.
- Premium (com conta): Procedimentos, Trombólise e Drogas vasoativas. O administrador também acessa tudo.
- Liberar à mão: `/admin.html` > Usuários > +30 dias, +1 ano ou Revogar.
- Pagamento automático (Stripe): crie produto e preço de assinatura, depois:
  `supabase functions deploy create-checkout` e `supabase functions deploy stripe-webhook --no-verify-jwt`.
  Segredos: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, `SITE_URL` (endereço do seu site, sem barra final).
  No Stripe, aponte o webhook para `<URL do projeto>/functions/v1/stripe-webhook` com os eventos `checkout.session.completed`, `invoice.paid` e `customer.subscription.deleted`.
  Em `config.js`, preencha `priceText` (ex.: "R$ 19,90/mês").
- Limite importante: o bloqueio das áreas premium é feito no aplicativo. Quem for técnico pode ler o conteúdo no código. Para proteger de verdade, o conteúdo premium precisa ficar no banco, liberado só a quem é premium (próxima etapa).

## Acesso gratuito temporário
Em `config.js`, `freeAccess:true` libera todas as áreas e mostra o aviso de que no futuro serão só para assinantes. Para voltar a exigir premium, troque para `freeAccess:false` e reenvie o site.
