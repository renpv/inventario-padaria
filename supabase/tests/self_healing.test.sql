-- Test script for shift self-healing
-- This script validates that when we start the 3rd shift (Tarde - entrada),
-- the 1st and 2nd shifts are automatically generated as 'NÃO REALIZADO'.

BEGIN;

-- 1. Setup mock shifts if they do not exist
-- (Already populated in migrations)

-- 2. Call iniciar_turno for the 3rd shift
-- Supposing 'Tarde - entrada' has a predefined UUID or we look it up
SELECT iniciar_turno(
    (SELECT id_turno FROM turnos WHERE nome_turno = 'Tarde - entrada' LIMIT 1),
    now()
);

-- 3. Verify results
SELECT 
    t.nome_turno,
    l.status,
    l.justificativa_forca
FROM lancamentos_op l
JOIN turnos t ON l.id_turno = t.id_turno
WHERE l.data::date = now()::date
ORDER BY t.ordem;

-- 4. Rollback to keep database clean
ROLLBACK;
