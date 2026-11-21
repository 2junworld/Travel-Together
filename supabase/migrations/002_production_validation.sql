-- Require a matching email and valid task/itinerary status; NULL type remains supported.
create or replace function public.travel_command(action text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog,public,travel_private as $$
declare
 uid uuid:=auth.uid(); tid uuid; fid uuid; iid uuid; new_id uuid; role_name text; member_family uuid; item public.travel_items; old public.travel_items; linked public.travel_items; req public.change_requests; inv travel_private.invites; doc jsonb; patch jsonb; v integer; s text; token text; target text; a jsonb; checked jsonb; clean jsonb; x text; new_email text; target_uid uuid; scope_family uuid; scope_owner uuid; result jsonb;
begin
 if uid is null then raise sqlstate 'PT401' using message='로그인이 필요합니다.';end if;
 if action='list_trips' then return coalesce((select jsonb_agg(to_jsonb(t) - 'created_by' order by t.start_date desc) from trips t where travel_private.member(t.id)),'[]');end if;
 if action='create_trip' then
 if length(trim(payload->>'title')) not between 1 and 100 or(payload->>'start_date')::date>(payload->>'end_date')::date or (payload->>'end_date')::date-(payload->>'start_date')::date>365 or not exists(select 1 from pg_timezone_names where name=coalesce(payload->>'timezone','Asia/Taipei'))then raise sqlstate 'PT422' using message='여행 이름·날짜·시간대를 확인해 주세요.';end if;
 insert into trips(title,start_date,end_date,timezone,created_by)values(trim(payload->>'title'),(payload->>'start_date')::date,(payload->>'end_date')::date,coalesce(payload->>'timezone','Asia/Taipei'),uid)returning id into tid;
 insert into trip_families(trip_id,name)values(tid,coalesce(nullif(trim(payload->>'family_name'),''),'우리 가족'))returning id into fid;
 insert into trip_members values(tid,uid,fid,'admin',true,coalesce(nullif(auth.jwt()->>'email',''),'여행자'));
 return jsonb_build_object('trip_id',tid);
 end if;
 if action in('invite_info','accept_invite')then
 select * into inv from travel_private.invites where token_hash=encode(digest(payload->>'token','sha256'),'hex') for update;
 if not found or lower(inv.email)<>lower(coalesce(auth.jwt()->>'email',''))then raise sqlstate 'PT404' using message='초대를 찾을 수 없습니다.';end if;
 if inv.used_at is not null then if inv.accepted_by=uid then return jsonb_build_object('trip_id',inv.trip_id);else raise sqlstate 'PT404' using message='초대를 찾을 수 없습니다.';end if;end if;
 if inv.expires_at<now()then raise sqlstate 'PT422' using message='초대가 만료되었습니다.';end if;
 perform 1 from trips where id=inv.trip_id and archived_at is null for update;
 if not found then raise sqlstate 'PT403' using message='보관된 여행의 초대는 수락할 수 없습니다.';end if;
 if action='invite_info'then return(select jsonb_build_object('title',t.title,'family_name',f.name)from trips t join trip_families f on f.trip_id=t.id and f.id=inv.family_id where t.id=inv.trip_id);end if;
 if exists(select 1 from trip_members where trip_id=inv.trip_id and user_id=uid)then raise sqlstate 'PT409' using message='이미 등록된 멤버입니다. 관리자에게 가족 배정을 요청해 주세요.';end if;
 insert into trip_members values(inv.trip_id,uid,inv.family_id,'member',true,auth.jwt()->>'email');
 update travel_private.invites set used_at=now(),accepted_by=uid where id=inv.id;
 return jsonb_build_object('trip_id',inv.trip_id);
 end if;
 tid:=(payload->>'tripId')::uuid;
 select role,family_id into role_name,member_family from trip_members where trip_id=tid and user_id=uid and active;
 if not found then raise sqlstate 'PT404' using message='여행을 찾을 수 없습니다.';end if;
 if action='get_data'then return jsonb_build_object('trip',(select to_jsonb(t)-'created_by' from trips t where t.id=tid),'items',coalesce((select jsonb_agg(to_jsonb(i)-'created_by')from travel_items i where i.trip_id=tid and travel_private.readable(tid,i.scope,i.family_id,i.owner_id)),'[]'),'members',coalesce((select jsonb_agg(to_jsonb(m))from trip_members m where m.trip_id=tid and active),'[]'),'families',coalesce((select jsonb_agg(to_jsonb(f))from trip_families f where f.trip_id=tid),'[]'),'requests',coalesce((select jsonb_agg(to_jsonb(r))from change_requests r join travel_items i on i.id=r.item_id where r.trip_id=tid and i.deleted_at is null and(travel_private.readable(tid,i.scope,i.family_id,i.owner_id)or r.request_type='publication'and role_name='admin')and(r.proposed_by=uid or role_name='admin')),'[]'),'userId',uid,'serverTime',now());end if;
 -- Serialize writes within one trip. Version checks are still required for stale clients.
 perform 1 from trips where id=tid for update;
 if action='save_trip'then
 if role_name<>'admin'then raise sqlstate 'PT403' using message='관리자만 수정할 수 있습니다.';end if;
 if not exists(select 1 from trips where id=tid and version=(payload->>'expectedVersion')::int)then raise sqlstate 'PT409' using message='여행 정보가 변경되었습니다.';end if;
 patch:=payload->'patch';
 if patch-'title'-'start_date'-'end_date'-'timezone'-'archived_at'<>'{}'then raise sqlstate 'PT422' using message='수정할 수 없는 필드입니다.';end if;
 if patch?'timezone'and not exists(select 1 from pg_timezone_names where name=patch->>'timezone')then raise sqlstate 'PT422' using message='시간대를 확인해 주세요.';end if;
 update trips set title=coalesce(patch->>'title',title),start_date=coalesce((patch->>'start_date')::date,start_date),end_date=coalesce((patch->>'end_date')::date,end_date),timezone=coalesce(patch->>'timezone',timezone),archived_at=case when patch?'archived_at'then(patch->>'archived_at')::timestamptz else archived_at end,version=version+1 where id=tid;
 return jsonb_build_object('ok',true);
 end if;
 if exists(select 1 from trips where id=tid and archived_at is not null)and action not in('private_get','scope_preview')then raise sqlstate 'PT403' using message='보관된 여행은 읽기 전용입니다.';end if;
 if action='import_items'then
 if role_name<>'admin'then raise sqlstate 'PT403' using message='관리자만 이관할 수 있습니다.';end if;
 if jsonb_typeof(payload->'items')<>'array'or jsonb_array_length(payload->'items')>100 then raise sqlstate 'PT422' using message='이관 목록을 확인해 주세요.';end if;
 for doc in select value from jsonb_array_elements(payload->'items')loop
 if not exists(select 1 from travel_items where trip_id=tid and(id=(doc->>'id')::uuid or data->>'source_key'=doc->'data'->>'source_key'))then
 perform public.travel_command('save_item',jsonb_build_object('tripId',tid,'item',doc,'expectedVersion',0));
 end if;end loop;return jsonb_build_object('ok',true);
 end if;
 if action='add_family'then
 if role_name<>'admin'then raise sqlstate 'PT403' using message='관리자 권한이 필요합니다.';end if;
 if length(trim(payload->>'name')) not between 1 and 100 then raise sqlstate 'PT422' using message='가족 이름을 확인해 주세요.';end if;
 insert into trip_families(trip_id,name)values(tid,trim(payload->>'name'))returning id into fid;return jsonb_build_object('id',fid);
 end if;
 if action='invite'then
 if role_name<>'admin'then raise sqlstate 'PT403' using message='관리자 권한이 필요합니다.';end if;
 new_email:=lower(trim(payload->>'email'));fid:=(payload->>'familyId')::uuid;
 if new_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'or not exists(select 1 from trip_families where trip_id=tid and id=fid)then raise sqlstate 'PT422' using message='이메일과 가족을 확인해 주세요.';end if;
 token:=encode(gen_random_bytes(32),'hex');insert into travel_private.invites(trip_id,family_id,email,token_hash)values(tid,fid,new_email,encode(digest(token,'sha256'),'hex'));return jsonb_build_object('token',token);
 end if;
 if action='members'then
 if role_name<>'admin'then raise sqlstate 'PT403' using message='관리자 권한이 필요합니다.';end if;
 target_uid:=(payload->>'userId')::uuid;fid:=(payload->>'familyId')::uuid;
 if not exists(select 1 from trip_members where trip_id=tid and user_id=target_uid)or not exists(select 1 from trip_families where trip_id=tid and id=fid)or payload->>'role'not in('admin','member')then raise sqlstate 'PT422' using message='멤버 정보를 확인해 주세요.';end if;
 if exists(select 1 from trip_members where trip_id=tid and user_id=target_uid and active and role='admin')and(payload->>'role'<>'admin'or not(payload->>'active')::boolean)and(select count(*)from trip_members where trip_id=tid and active and role='admin')<=1 then raise sqlstate 'PT403' using message='마지막 관리자는 제외하거나 강등할 수 없습니다.';end if;
 update trip_members set family_id=fid,role=payload->>'role',active=(payload->>'active')::boolean where trip_id=tid and user_id=target_uid;
 -- Drop assignments that are no longer readers; clear completion if no assignee remains.
 for item in select * from travel_items where trip_id=tid and data->'assignees' ? target_uid::text loop
 a:=coalesce((select jsonb_agg(value)from jsonb_array_elements_text(item.data->'assignees') value join trip_members m on m.trip_id=tid and m.user_id=value::uuid and m.active where item.scope='trip'or item.scope='family'and m.family_id=item.family_id or item.scope='personal'and m.user_id=item.owner_id),'[]');
 checked:=coalesce((select jsonb_agg(value)from jsonb_array_elements_text(coalesce(item.data->'checked','[]')) value where a?value),'[]');
 update travel_items set data=item.data||jsonb_build_object('assignees',a,'checked',checked,'complete',false),version=version+1,updated_at=now()where id=item.id;
 end loop;return jsonb_build_object('ok',true);
 end if;
 if action='review'then
 if role_name<>'admin'then raise sqlstate 'PT403' using message='관리자 권한이 필요합니다.';end if;
 select r.* into req from change_requests r join travel_items i on i.id=r.item_id where r.id=(payload->>'requestId')::uuid and r.trip_id=tid and i.deleted_at is null and(i.scope='trip'or r.request_type='publication')for update of r;
 if not found then raise sqlstate 'PT404' using message='제안을 찾을 수 없습니다.';end if;
 if req.status<>'pending'then raise sqlstate 'PT409' using message='이미 처리한 제안입니다.';end if;
 select * into item from travel_items where id=req.item_id for update;
 if payload->>'status'not in('approved','rejected')then raise sqlstate 'PT422' using message='처리 상태를 확인해 주세요.';end if;
 if payload->>'status'='approved'then
 if req.request_type='change'and item.version<>req.base_version then raise sqlstate 'PT409' using message='원본이 변경되어 재제안이 필요합니다.';end if;
 -- Reuse the normal validation path before recording approval; nested call is atomic.
 if req.request_type='publication'then
 new_id:=gen_random_uuid();doc:=jsonb_build_object('id',new_id,'kind','itinerary','title',req.patch->>'title','scope','trip','family_id',null,'owner_id',null,'data',req.patch->'data');
 perform public.travel_command('save_item',jsonb_build_object('tripId',tid,'item',doc,'expectedVersion',0));
 else
 doc:=jsonb_build_object('id',item.id,'kind',item.kind,'title',coalesce(req.patch->>'title',item.title),'scope',item.scope,'family_id',item.family_id,'owner_id',item.owner_id,'data',coalesce(req.patch->'data',item.data));
 perform public.travel_command('save_item',jsonb_build_object('tripId',tid,'item',doc,'expectedVersion',item.version));
 end if;
 end if;
 update change_requests set status=payload->>'status',processed_by=uid,processed_at=now()where id=req.id;
 return jsonb_build_object('ok',true);
 end if;
 if action='save_item'then iid:=(payload->'item'->>'id')::uuid;else iid:=(payload->>'itemId')::uuid;end if;
 select * into item from travel_items where id=iid and trip_id=tid for update;
 if action<>'save_item'and(not found or not travel_private.readable(tid,item.scope,item.family_id,item.owner_id))then raise sqlstate 'PT404' using message='항목을 찾을 수 없습니다.';end if;
 if action in('private_get','private_save')then
 if item.kind<>'itinerary'or item.deleted_at is not null then raise sqlstate 'PT404' using message='항목을 찾을 수 없습니다.';end if;
 target:=coalesce(payload->>'detailScope','personal');
 if target not in('personal','family')then raise sqlstate 'PT422' using message='상세 범위를 확인해 주세요.';end if;
 if action='private_get'then return coalesce((select jsonb_build_object('value',value,'version',version)from itinerary_private_details where itinerary_id=iid and scope=target and(target='personal'and owner_id=uid or target='family'and family_id=member_family)),'{}');end if;
 select version into v from itinerary_private_details where itinerary_id=iid and scope=target and(target='personal'and owner_id=uid or target='family'and family_id=member_family)for update;
 if coalesce(v,0)<>coalesce((payload->>'expectedVersion')::int,0)then raise sqlstate 'PT409' using message='비공개 상세가 변경되었습니다.';end if;
 if target='personal'then
 insert into itinerary_private_details(trip_id,itinerary_id,scope,owner_id,value)values(tid,iid,'personal',uid,left(payload->>'value',10000))on conflict(itinerary_id,owner_id)where scope='personal'do update set value=excluded.value,version=itinerary_private_details.version+1,updated_at=now();
 else
 insert into itinerary_private_details(trip_id,itinerary_id,scope,family_id,value)values(tid,iid,'family',member_family,left(payload->>'value',10000))on conflict(itinerary_id,family_id)where scope='family'do update set value=excluded.value,version=itinerary_private_details.version+1,updated_at=now();
 end if;return jsonb_build_object('version',coalesce(v,0)+1);
 end if;
 if action='propose_publication'then
 if item.scope<>'personal'or item.owner_id<>uid or item.kind<>'itinerary'or item.deleted_at is not null then raise sqlstate 'PT403' using message='본인의 개인 일정만 공동 게시를 제안할 수 있습니다.';end if;
 if item.version<>coalesce((payload->>'expectedVersion')::int,-1)then raise sqlstate 'PT409' using message='원본이 변경되었습니다.';end if;
 patch:=payload->'patch';
 if patch-'title'-'data'<>'{}'or length(patch->>'title')not between 1 and 200 or(patch->'data')-'date'-'endDate'-'type'-'status'-'note'-'start'-'end'-'startZone'-'endZone'-'place_id'<>'{}'then raise sqlstate 'PT422' using message='선택한 공유 필드를 확인해 주세요.';end if;
 if patch->'data'->>'place_id'is not null and not exists(select 1 from travel_items where id=(patch->'data'->>'place_id')::uuid and trip_id=tid and kind='places'and scope='trip'and deleted_at is null)then raise sqlstate 'PT422' using message='공동 장소만 게시 제안에 포함할 수 있습니다.';end if;
 insert into change_requests(trip_id,item_id,proposed_by,base_version,request_type,before,patch)values(tid,iid,uid,item.version,'publication','{}',patch);return jsonb_build_object('ok',true);
 end if;
 if action='propose'then
 if item.scope<>'trip'or item.kind<>'itinerary'or item.deleted_at is not null then raise sqlstate 'PT403' using message='공동 일정에만 제안할 수 있습니다.';end if;
 if item.version<>coalesce((payload->>'expectedVersion')::int,-1) then raise sqlstate 'PT409' using message='원본이 변경되었습니다.';end if;
 patch:=payload->'patch';if patch-'title'-'data'<>'{}'or length(patch->>'title')not between 1 and 200 then raise sqlstate 'PT422' using message='제안 내용을 확인해 주세요.';end if;
 -- Shared itinerary only; no access to another account's private details.
 insert into change_requests(trip_id,item_id,proposed_by,base_version,before,patch)values(tid,iid,uid,item.version,jsonb_build_object('title',item.title,'data',item.data),patch);return jsonb_build_object('ok',true);
 end if;
 if action='scope_preview'then
 if not travel_private.editable(item)then raise sqlstate 'PT403' using message='편집 권한이 없습니다.';end if;
 return jsonb_build_object('message',case payload->>'target'when'trip'then'전체 여행 멤버에게 제목과 공개 메모를 공유합니다.'when'family'then'같은 가족의 구성원에게 제목과 공개 메모를 공유합니다.'else'본인만 보는 범위로 변경합니다. 가족 항목은 개인 사본을 생성합니다.'end||' 비공개 상세는 공유되지 않습니다. 범위를 벗어난 연결과 담당자는 해제됩니다.','version',item.version);
 end if;
 if action<>'save_item'then
 if action='check_item'then
 if item.kind<>'checklist'or not travel_private.readable(tid,item.scope,item.family_id,item.owner_id)then raise sqlstate 'PT403' using message='준비물을 체크할 수 없습니다.';end if;
 else if not travel_private.editable(item)then raise sqlstate 'PT403' using message='편집 권한이 없습니다.';end if;end if;
 if item.version<>coalesce((payload->>'expectedVersion')::int,-1) then raise sqlstate 'PT409' using message='다른 사용자가 먼저 변경했습니다.';end if;
 if item.deleted_at is not null and action<>'restore_item'then raise sqlstate 'PT404' using message='항목을 찾을 수 없습니다.';end if;
 end if;
 if action='delete_item'then
 update travel_items set deleted_at=now(),version=version+1,updated_at=now()where id=iid;
 update travel_items set data=case item.kind when'places'then data-'place_id'else data-'itinerary_id'end,version=version+1,updated_at=now()where trip_id=tid and(item.kind='places'and data->>'place_id'=iid::text or item.kind='itinerary'and data->>'itinerary_id'=iid::text);
 return jsonb_build_object('ok',true);
 elsif action='restore_item'then update travel_items set deleted_at=null,version=version+1,updated_at=now()where id=iid;return jsonb_build_object('ok',true);
 elsif action='check_item'then
 a:=coalesce(item.data->'assignees','[]');checked:=coalesce(item.data->'checked','[]');
 if jsonb_array_length(a)>0 then
 if not a?uid::text then raise sqlstate 'PT403' using message='담당자는 자신의 준비 상태만 체크할 수 있습니다.';end if;
 checked:=coalesce((select jsonb_agg(value)from jsonb_array_elements_text(checked)value where value<>uid::text),'[]');
 if(payload->>'checked')::boolean then checked:=checked||jsonb_build_array(uid::text);end if;
 patch:=jsonb_build_object('checked',checked,'complete',false,'completed_at',case when jsonb_array_length(checked)=jsonb_array_length(a)then now()else null end,'completed_by',case when jsonb_array_length(checked)=jsonb_array_length(a)then uid else null end);
 else patch:=jsonb_build_object('complete',(payload->>'checked')::boolean,'completed_at',case when(payload->>'checked')::boolean then now()else null end,'completed_by',case when(payload->>'checked')::boolean then uid else null end);end if;
 update travel_items set data=data||patch,version=version+1,updated_at=now()where id=iid;return jsonb_build_object('ok',true);
 elsif action='scope_change'then
 target:=payload->>'target';if target not in('trip','family','personal')then raise sqlstate 'PT422' using message='공개 범위를 확인해 주세요.';end if;
 if target='trip'and item.kind in('itinerary','places')and role_name<>'admin'then raise sqlstate 'PT403' using message='공동 게시에는 관리자 권한이 필요합니다.';end if;
 if item.scope='personal'and target='trip'and item.kind='itinerary'then raise sqlstate 'PT403' using message='개인 일정은 공유할 필드를 선택해 공동 게시를 제안해 주세요.';end if;
 if item.scope='family'and target='personal'then
 new_id:=gen_random_uuid();insert into travel_items(id,trip_id,kind,title,scope,owner_id,created_by,data)values(new_id,tid,item.kind,item.title,'personal',uid,uid,item.data||jsonb_build_object('assignees','[]'::jsonb,'checked','[]'::jsonb,'complete',false));return jsonb_build_object('id',new_id);
 end if;
 update travel_items set scope=target,family_id=case when target='family'then member_family else null end,owner_id=case when target='personal'then uid else null end,data=data||jsonb_build_object('assignees','[]'::jsonb,'checked','[]'::jsonb,'complete',false),version=version+1,updated_at=now()where id=iid returning * into item;
 -- Sever all links whose reader set no longer fits the new scope.
 update travel_items set data=data-'place_id',version=version+1 where trip_id=tid and data->>'place_id'=iid::text and not(item.scope='trip'or item.scope='family'and(scope='family'and family_id=item.family_id or scope='personal'and exists(select 1 from trip_members m where m.trip_id=tid and m.user_id=owner_id and m.family_id=item.family_id))or item.scope='personal'and scope='personal'and owner_id=item.owner_id);
 update travel_items set data=data-'itinerary_id',version=version+1 where trip_id=tid and data->>'itinerary_id'=iid::text and not(item.scope='trip'or item.scope='family'and(scope='family'and family_id=item.family_id or scope='personal'and exists(select 1 from trip_members m where m.trip_id=tid and m.user_id=owner_id and m.family_id=item.family_id))or item.scope='personal'and scope='personal'and owner_id=item.owner_id);
 if item.kind='itinerary'and item.data?'place_id'then
 select * into linked from travel_items where id=(item.data->>'place_id')::uuid and trip_id=tid;
 if not found or not(linked.scope='trip'or linked.scope='family'and item.scope='family'and linked.family_id=item.family_id or linked.scope='personal'and item.scope='personal'and linked.owner_id=item.owner_id)then update travel_items set data=data-'place_id'where id=iid;end if;
 end if;
 return jsonb_build_object('ok',true);
 elsif action<>'save_item'then raise sqlstate 'PT422' using message='지원하지 않는 요청입니다.';
 end if;
 -- Save validation. Existing scope and owner are immutable on this path.
 doc:=payload->'item';v:=coalesce((payload->>'expectedVersion')::int,-1);old:=item;
 if item.id is not null then
 if not travel_private.readable(tid,item.scope,item.family_id,item.owner_id)then raise sqlstate 'PT404' using message='항목을 찾을 수 없습니다.';end if;
 if not travel_private.editable(item)then raise sqlstate 'PT403' using message='편집 권한이 없습니다.';end if;
 if item.version<>v then raise sqlstate 'PT409' using message='다른 사용자가 먼저 변경했습니다.';end if;
 if item.scope<>doc->>'scope'or item.kind<>doc->>'kind'or item.family_id is distinct from(doc->>'family_id')::uuid or item.owner_id is distinct from(doc->>'owner_id')::uuid or item.deleted_at is not null then raise sqlstate 'PT403' using message='공개 범위는 전용 작업으로 변경해 주세요.';end if;
 else
 if v<>0 then raise sqlstate 'PT404' using message='항목을 찾을 수 없습니다.';end if;
 if doc->>'scope'not in('trip','family','personal')or doc->>'kind'not in('itinerary','places','checklist','tasks')then raise sqlstate 'PT422' using message='유형을 확인해 주세요.';end if;
 if doc->>'scope'='trip'and doc->>'kind'in('itinerary','places')and role_name<>'admin'then raise sqlstate 'PT403' using message='공동 일정과 장소는 관리자만 등록할 수 있습니다.';end if;
 if doc->>'scope'='family'and(doc->>'family_id')::uuid is distinct from member_family or doc->>'scope'='personal'and(doc->>'owner_id')::uuid is distinct from uid then raise sqlstate 'PT403' using message='가족 또는 소유자 배정을 확인해 주세요.';end if;
 item.id:=iid;item.trip_id:=tid;item.kind:=doc->>'kind';item.scope:=doc->>'scope';item.family_id:=case when item.scope='family'then member_family else null end;item.owner_id:=case when item.scope='personal'then uid else null end;
 end if;
 if coalesce(length(trim(doc->>'title')),0)not between 1 and 200 then raise sqlstate 'PT422' using message='제목을 입력해 주세요.';end if;
 clean:=coalesce(doc->'data','{}');
 if jsonb_typeof(clean)<>'object'or octet_length(clean::text)>30000 or clean-'date'-'endDate'-'start'-'end'-'startZone'-'endZone'-'type'-'status'-'note'-'place_id'-'itinerary_id'-'families'-'quantity'-'category'-'source_key'-'listName'-'deadline'-'dueTime'-'priority'-'assignees'-'checked'-'complete'-'lat'-'lng'-'address'-'completed_at'-'completed_by'<>'{}'then raise sqlstate 'PT422' using message='항목 필드를 확인해 주세요.';end if;
 if clean->>'lat'is not null and(abs((clean->>'lat')::numeric)>90 or abs((clean->>'lng')::numeric)>180)or(clean->>'lat'is null)<>(clean->>'lng'is null)then raise sqlstate 'PT422' using message='좌표를 확인해 주세요.';end if;
 if item.kind='itinerary'then
 if clean->>'date'is null or(clean->>'type'is not null and clean->>'type'not in('항공','숙박','식사','관광','이동','휴식'))or coalesce(clean->>'status','')not in('확정','확인 필요','미정','취소')then raise sqlstate 'PT422' using message='일정 날짜·유형·상태를 확인해 주세요.';end if;
 perform(clean->>'date')::date;
 if clean->>'endDate'is not null and(clean->>'endDate')::date<(clean->>'date')::date then raise sqlstate 'PT422' using message='일정 날짜 순서를 확인해 주세요.';end if;
 if clean->>'start'is not null then perform(clean->>'start')::time;end if;if clean->>'end'is not null then perform(clean->>'end')::time;end if;
 if clean->>'start'is not null and clean->>'end'is not null and((clean->>'date')::date+(clean->>'start')::time)at time zone coalesce(clean->>'startZone','Asia/Taipei')>(coalesce(clean->>'endDate',clean->>'date')::date+(clean->>'end')::time)at time zone coalesce(clean->>'endZone','Asia/Taipei')then raise sqlstate 'PT422' using message='종료 시각이 시작보다 빠릅니다.';end if;
 end if;
 if item.kind='checklist'and coalesce((clean->>'quantity')::numeric,0)<=0 then raise sqlstate 'PT422' using message='수량은 양수여야 합니다.';end if;
 if item.kind='tasks'and(coalesce(clean->>'status','')not in('예정','진행','완료')or coalesce(clean->>'priority','')not in('높음','보통','낮음'))then raise sqlstate 'PT422' using message='상태·우선순위를 확인해 주세요.';end if;
 if clean->>'deadline'is not null then perform(clean->>'deadline')::date;end if;
 a:=coalesce(clean->'assignees','[]');if jsonb_typeof(a)<>'array'then raise sqlstate 'PT422' using message='담당자 목록을 확인해 주세요.';end if;
 for x in select jsonb_array_elements_text(a)loop
 if not exists(select 1 from trip_members m where m.trip_id=tid and m.user_id=x::uuid and m.active and(item.scope='trip'or item.scope='family'and m.family_id=item.family_id or item.scope='personal'and m.user_id=uid))then raise sqlstate 'PT422' using message='공개 범위 밖의 담당자입니다.';end if;
 end loop;
 if(select count(*)from jsonb_array_elements_text(a))<>(select count(distinct value)from jsonb_array_elements_text(a))then raise sqlstate 'PT422' using message='담당자가 중복되었습니다.';end if;
 for x in select jsonb_array_elements_text(coalesce(clean->'families','[]'))loop if not exists(select 1 from trip_families where trip_id=tid and id=x::uuid)then raise sqlstate 'PT422' using message='다른 여행의 가족을 연결할 수 없습니다.';end if;end loop;
 if clean->>'place_id'is not null then
 select * into linked from travel_items where trip_id=tid and id=(clean->>'place_id')::uuid and kind='places'and deleted_at is null;
 if not found or not travel_private.readable(tid,linked.scope,linked.family_id,linked.owner_id)or not(linked.scope='trip'or item.scope='family'and linked.scope='family'and linked.family_id=item.family_id or item.scope='personal'and travel_private.readable(tid,linked.scope,linked.family_id,linked.owner_id))then raise sqlstate 'PT422' using message='일정 독자 모두가 볼 수 있는 장소만 연결할 수 있습니다.';end if;
 end if;
 if clean->>'itinerary_id'is not null then
 select * into linked from travel_items where trip_id=tid and id=(clean->>'itinerary_id')::uuid and kind='itinerary'and deleted_at is null;
 if not found or not travel_private.readable(tid,linked.scope,linked.family_id,linked.owner_id)or not(linked.scope='trip'or item.scope='family'and linked.scope='family'and linked.family_id=item.family_id or item.scope='personal'and travel_private.readable(tid,linked.scope,linked.family_id,linked.owner_id))then raise sqlstate 'PT422' using message='항목 독자가 볼 수 있는 일정만 연결할 수 있습니다.';end if;
 end if;
 -- A full edit cannot spoof another person's check state or completion actor.
 checked:=coalesce((select jsonb_agg(value)from jsonb_array_elements_text(coalesce(old.data->'checked','[]'))value where a?value),'[]');
 clean:=clean-'checked'-'complete'-'completed_at'-'completed_by';
 clean:=clean||jsonb_build_object('assignees',a,'checked',checked,'complete',case when old.data->'assignees'=a then coalesce((old.data->>'complete')::boolean,false)else false end);
 if item.kind='tasks'and clean->>'status'='완료'then clean:=clean||jsonb_build_object('completed_by',uid,'completed_at',coalesce(old.data->>'completed_at',now()::text));elsif item.kind='checklist'and jsonb_array_length(a)>0 and jsonb_array_length(checked)=jsonb_array_length(a)then clean:=clean||jsonb_build_object('completed_by',uid,'completed_at',now());end if;
 if old.id is null then
 insert into travel_items(id,trip_id,kind,title,scope,family_id,owner_id,created_by,data)values(iid,tid,item.kind,trim(doc->>'title'),item.scope,item.family_id,item.owner_id,uid,clean);
 else update travel_items set title=trim(doc->>'title'),data=clean,version=version+1,updated_at=now()where id=iid;end if;
 return jsonb_build_object('id',iid,'version',case when old.id is null then 1 else old.version+1 end);
end$$;
revoke all on function public.travel_command(text,jsonb) from public,anon;
grant execute on function public.travel_command(text,jsonb) to authenticated;
