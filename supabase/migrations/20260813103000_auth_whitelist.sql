-- Substitui o gatilho antigo por um gatilho de Whitelist estrita
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
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

-- Garante que o gatilho está ativado
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
