-- JÁ APLICADO no projeto doses-ps (migration doses_ps_schema_aprovacao).
-- Use este arquivo só para recriar em outro projeto: cole no SQL Editor do Supabase.
create table public.profiles(id uuid primary key references auth.users(id) on delete cascade, role text not null default 'admin' check (role='admin'));
create table public.app_config(key text primary key, value boolean not null);
insert into public.app_config values ('require_approval', false);
create table public.content(id int primary key default 1 check (id=1), data jsonb not null, version int not null default 1, note text, updated_by uuid, updated_at timestamptz not null default now(),
 constraint formato check (jsonb_typeof(data->'drugs')='array' and jsonb_typeof(data->'procs')='array'));
create table public.content_history(id bigserial primary key, version int not null, data jsonb not null, note text, changed_by uuid, changed_at timestamptz not null default now());
create table public.proposals(id bigserial primary key, base_version int not null, data jsonb not null, note text not null, status text not null default 'pending' check (status in ('pending','approved','rejected')), proposed_by uuid not null, reviewed_by uuid, created_at timestamptz not null default now(), reviewed_at timestamptz,
 constraint formato check (jsonb_typeof(data->'drugs')='array' and jsonb_typeof(data->'procs')='array'));
insert into public.content(data) values ('{"drugs":[],"procs":[]}');
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role='admin') and coalesce(auth.jwt()->>'aal','')='aal2' $$;
create or replace function public.content_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin if new.version<>old.version+1 then raise exception 'conflito de versao'; end if; new.updated_by:=auth.uid(); new.updated_at:=now(); return new; end $$;
create or replace function public.content_log() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.content_history(version,data,note,changed_by) values(new.version,new.data,new.note,auth.uid()); return new; end $$;
create trigger t_guard before update on public.content for each row execute function public.content_guard();
create trigger t_log after update on public.content for each row execute function public.content_log();
create or replace function public.submit_change(p_data jsonb, p_note text, p_base int) returns text language plpgsql security definer set search_path='' as $$
declare v int; req boolean; pid bigint;
begin
 if not public.is_admin() then raise exception 'acesso negado'; end if;
 if coalesce(trim(p_note),'')='' then raise exception 'informe o motivo'; end if;
 select version into v from public.content where id=1 for update;
 if v<>p_base then raise exception 'conflito de versao'; end if;
 select value into req from public.app_config where key='require_approval';
 insert into public.proposals(base_version,data,note,proposed_by) values(p_base,p_data,p_note,auth.uid()) returning id into pid;
 if coalesce(req,true) then return 'pending'; end if;
 update public.content set data=p_data, version=v+1, note=p_note where id=1;
 update public.proposals set status='approved', reviewed_by=auth.uid(), reviewed_at=now() where id=pid;
 return 'published';
end $$;
create or replace function public.review_change(p_id bigint, p_ok boolean) returns text language plpgsql security definer set search_path='' as $$
declare pr public.proposals; v int; req boolean;
begin
 if not public.is_admin() then raise exception 'acesso negado'; end if;
 select * into pr from public.proposals where id=p_id and status='pending' for update;
 if not found then raise exception 'proposta nao encontrada'; end if;
 if not p_ok then update public.proposals set status='rejected', reviewed_by=auth.uid(), reviewed_at=now() where id=p_id; return 'rejected'; end if;
 select value into req from public.app_config where key='require_approval';
 if coalesce(req,true) and pr.proposed_by=auth.uid() then raise exception 'a aprovacao deve ser de outro administrador'; end if;
 select version into v from public.content where id=1 for update;
 if v<>pr.base_version then update public.proposals set status='rejected', reviewed_by=auth.uid(), reviewed_at=now() where id=p_id; raise exception 'conflito de versao: proposta recusada, refaca a partir da versao atual'; end if;
 update public.content set data=pr.data, version=v+1, note=pr.note where id=1;
 update public.proposals set status='approved', reviewed_by=auth.uid(), reviewed_at=now() where id=p_id;
 return 'published';
end $$;
alter table public.profiles enable row level security;
alter table public.app_config enable row level security;
alter table public.content enable row level security;
alter table public.content_history enable row level security;
alter table public.proposals enable row level security;
create policy "ver proprio perfil" on public.profiles for select to authenticated using (id=auth.uid());
create policy "leitura publica" on public.content for select to anon, authenticated using (true);
create policy "admin le historico" on public.content_history for select to authenticated using (public.is_admin());
create policy "admin le propostas" on public.proposals for select to authenticated using (public.is_admin());
create policy "admin le config" on public.app_config for select to authenticated using (public.is_admin());
revoke all on public.profiles, public.app_config, public.content_history, public.proposals from anon, authenticated;
revoke all on public.content from anon, authenticated;
grant select on public.content to anon, authenticated;
grant select on public.profiles, public.app_config, public.content_history, public.proposals to authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.is_admin(), public.submit_change(jsonb,text,int), public.review_change(bigint,boolean) to authenticated;
