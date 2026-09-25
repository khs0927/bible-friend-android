-- Database security tests (pgTAP). Run with: pnpm db:test  (supabase test db)
begin;
select plan(14);

-- Two guardians (the auth trigger creates their guardian rows).
insert into auth.users (id, email, instance_id, aud, role)
values
  ('11111111-1111-1111-1111-111111111111', 'a@test.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

select is(
  (select count(*)::int from public.guardians where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')),
  2,
  'auth trigger creates guardian rows'
);

-- Act as guardian A.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select throws_ok(
  $$insert into public.children (guardian_id, nickname) values ('11111111-1111-1111-1111-111111111111', '하늘')$$,
  '42501',
  null,
  'children cannot be created before consent'
);

update public.guardians set consented_at = now() where id = '11111111-1111-1111-1111-111111111111';

select lives_ok(
  $$insert into public.children (id, guardian_id, nickname, birth_year)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '하늘', 2018)$$,
  'children can be created after consent'
);

select throws_ok(
  $$insert into public.children (guardian_id, nickname) values ('22222222-2222-2222-2222-222222222222', '남의 아이')$$,
  '42501',
  null,
  'cannot create a child for another guardian'
);

select lives_ok(
  $$insert into public.prayer_notes (child_id, body) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '감사 기도')$$,
  'guardian can write prayer notes for own child'
);

select throws_ok(
  $$insert into public.chat_messages (child_id, role, content) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'friend', 'forged')$$,
  '42501',
  null,
  'client cannot write chat messages'
);

select throws_ok(
  $$insert into public.growth_profiles (child_id, profile) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '{}'::jsonb)$$,
  '42501',
  null,
  'client cannot write growth state'
);

select throws_ok(
  $$insert into public.treasure_cards (child_id, card_id) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'card-love-1')$$,
  '42501',
  null,
  'client cannot grant treasure cards'
);

select throws_ok(
  $$select public.consume_ai_quota('11111111-1111-1111-1111-111111111111', 'chat', -1000, 999999)$$,
  '42501',
  null,
  'client cannot call the quota function'
);

-- Act as guardian B: sees and changes nothing of A.
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select is((select count(*)::int from public.children), 0, 'other guardian sees no children');
select is((select count(*)::int from public.prayer_notes), 0, 'other guardian sees no prayer notes');

delete from public.children where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
reset role;
select is(
  (select count(*)::int from public.children where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1,
  'other guardian cannot delete the child'
);

-- Quota: the limit is enforced and a rejected request does not consume budget.
select ok(public.consume_ai_quota('11111111-1111-1111-1111-111111111111', 'chat', 2, 3), 'quota allows usage under the limit');
select ok(
  not public.consume_ai_quota('11111111-1111-1111-1111-111111111111', 'chat', 2, 3)
  and (select units from public.ai_usage where guardian_id = '11111111-1111-1111-1111-111111111111' and kind = 'chat') = 2,
  'quota rejects usage over the limit and rolls the increment back'
);

select * from finish();
rollback;
