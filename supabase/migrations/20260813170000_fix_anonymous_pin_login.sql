-- Corrige o gatilho de whitelist (handle_new_user) que estava bloqueando o
-- login operacional por PIN. O fluxo de PIN usa signInAnonymously() para
-- satisfazer as políticas de RLS (TO authenticated), mas o gatilho de
-- whitelist do OAuth (20260813103000_auth_whitelist.sql) recusava QUALQUER
-- inserção em auth.users sem e-mail cadastrado, inclusive as anônimas —
-- resultando em "Database error creating anonymous user" (500) ao tentar
-- entrar como operador.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Sessões anônimas (login operacional por PIN) não passam pela whitelist.
  IF new.is_anonymous THEN
    RETURN new;
  END IF;

  -- Verifica se o e-mail já foi pré-cadastrado na tabela usuarios
  IF EXISTS (SELECT 1 FROM public.usuarios WHERE email = new.email) THEN
    -- Vincula o novo login do Auth ao cadastro existente
    UPDATE public.usuarios
    SET auth_user_id = new.id,
        nome = COALESCE(NULLIF(nome, ''), new.raw_user_meta_data->>'full_name')
    WHERE email = new.email;
    RETURN new;
  ELSE
    -- Se o e-mail não estiver na Whitelist, recusa a criação do usuário no Supabase Auth
    RAISE EXCEPTION 'Acesso negado: O e-mail (%) não consta na Whitelist do sistema.', new.email;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
