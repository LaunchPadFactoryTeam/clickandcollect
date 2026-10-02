-- Lot 0 : vérifie que le harnais pgTAP fonctionne. Les tests RLS du lot 2 suivront ce modèle.
begin;
select plan(2);
select has_extension('pgtap', 'l''extension pgTAP est installée');
select cmp_ok(current_setting('server_version_num')::int, '>=', 160000, 'Postgres 16 ou plus');
select * from finish();
rollback;
