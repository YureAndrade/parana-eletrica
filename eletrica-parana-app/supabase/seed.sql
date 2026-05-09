-- Seed manual: rode após criar o primeiro usuário pelo Auth do Supabase.
-- Substitua o e-mail abaixo pelo do admin inicial.
--
--   update public.profiles
--      set role = 'admin', full_name = 'Administrador'
--    where id = (select id from auth.users where email = 'admin@eletricaparana.com.br');
--
-- Configuração padrão de envio do relatório:
update public.report_config
   set recipients = array['compras@eletricaparana.com.br'],
       send_day  = 1,  -- segunda
       send_hour = 7,
       active    = true,
       updated_at = now()
 where true;
