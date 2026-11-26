-- Extend only the item-data validation in the existing versioned save RPC.
do $migration$
declare
  definition text := pg_get_functiondef('public.travel_command(text,jsonb)'::regprocedure);
  field_anchor constant text := 'clean-''date''-''endDate''';
  validation_anchor constant text := 'if jsonb_typeof(clean)<>''object''';
begin
  if strpos(definition, field_anchor) = 0 or strpos(definition, validation_anchor) = 0 then
    raise exception 'Unexpected travel_command item validation';
  end if;
  definition := replace(definition, field_anchor, 'clean-''bag''-''date''-''endDate''');
  definition := replace(definition, validation_anchor, $check$
    if clean ? 'bag' then
      if item.kind <> 'checklist' or jsonb_typeof(clean->'bag') <> 'string'
         or length(trim(clean->>'bag')) > 60 then
        raise sqlstate 'PT422' using message='가방 라벨은 준비물에 60자 이내로 입력해 주세요.';
      end if;
      clean := clean - 'bag' || jsonb_strip_nulls(jsonb_build_object('bag', nullif(trim(clean->>'bag'), '')));
    end if;
    $check$ || validation_anchor);
  execute definition;
end
$migration$;
