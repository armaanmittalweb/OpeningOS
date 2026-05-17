do $$
declare
  r record;
begin
  for r in
    select table_name
    from information_schema.columns
    where table_schema = 'public'
      and column_name = 'user_id'
      and table_name in (
        'user_sessions','password_reset_tokens','recovery_codes','oauth_accounts','passkeys',
        'sync_conflicts','sync_change_batches','position_comments','share_access_logs',
        'team_libraries','team_library_items','billing_events','audit_events'
      )
  loop
    execute format('alter table %I enable row level security', r.table_name);
    execute format('drop policy if exists own_rows on %I', r.table_name);
    execute format(
      'create policy own_rows on %I using (user_id::text = current_setting(''app.current_user_id'', true)) with check (user_id::text = current_setting(''app.current_user_id'', true))',
      r.table_name
    );
  end loop;
end $$;
