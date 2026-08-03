-- Keep the `storage` edge function warm so file uploads don't pay a ~1.8s cold
-- start. A tiny "warm" POST every 5 minutes keeps the isolate alive. The warm
-- action is a pre-auth no-op, so no secret is needed.

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'vkm-warm-storage') then
      perform cron.unschedule('vkm-warm-storage');
    end if;
    perform cron.schedule(
      'vkm-warm-storage',
      '*/5 * * * *',
      $cmd$
      select net.http_post(
        url := 'https://ehsbzxrekrhmmpvbxlfv.supabase.co/functions/v1/storage',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object('action', 'warm')
      );
      $cmd$
    );
  end if;
end $$;
