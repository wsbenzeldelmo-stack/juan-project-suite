-- Align live project_items with the current Workspace structured order-item contract
-- while preserving legacy price/qty/type compatibility.

alter table public.project_items
  add column if not exists parent_item_id text,
  add column if not exists catalog_service_id uuid,
  add column if not exists catalog_package_id uuid,
  add column if not exists item_type text not null default 'SOLO',
  add column if not exists quantity integer not null default 1,
  add column if not exists unit_price numeric(12,2) not null default 0,
  add column if not exists billable boolean not null default true,
  add column if not exists counts_as_deliverable boolean not null default true,
  add column if not exists status text not null default 'Pending',
  add column if not exists progress integer not null default 0,
  add column if not exists due_date date,
  add column if not exists completed_at timestamptz,
  add column if not exists shared_drive_url text,
  add column if not exists client_visible boolean not null default true;

update public.project_items
set
  item_type = case upper(coalesce(type,'SOLO'))
    when 'PACKAGE' then 'PACKAGE'
    when 'PACKAGE_COMPONENT' then 'PACKAGE_COMPONENT'
    when 'CUSTOM' then 'CUSTOM'
    else 'SOLO'
  end,
  quantity = greatest(coalesce(qty,1),1),
  unit_price = greatest(coalesce(price,0),0);

do $$ begin
  alter table public.project_items
    add constraint project_items_parent_item_fkey
    foreign key (parent_item_id) references public.project_items(id) on delete cascade;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.project_items
    add constraint project_items_quantity_check check (quantity > 0);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.project_items
    add constraint project_items_progress_check check (progress between 0 and 100);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.project_items
    add constraint project_items_item_type_check
    check (item_type in ('SOLO','PACKAGE','PACKAGE_COMPONENT','CUSTOM'));
exception when duplicate_object then null; end $$;

create index if not exists project_items_parent_idx on public.project_items(parent_item_id);
create index if not exists project_items_deliverable_idx on public.project_items(project_id,counts_as_deliverable);

create or replace function public.sync_project_item_compat()
returns trigger
language plpgsql
set search_path=public
as $$
declare normalized_type text;
begin
  normalized_type := case upper(coalesce(new.type,'SOLO'))
    when 'PACKAGE' then 'PACKAGE'
    when 'PACKAGE_COMPONENT' then 'PACKAGE_COMPONENT'
    when 'CUSTOM' then 'CUSTOM'
    else 'SOLO'
  end;

  if tg_op='INSERT' then
    if coalesce(new.unit_price,0)=0 and coalesce(new.price,0)<>0 then
      new.unit_price := greatest(coalesce(new.price,0),0);
    else
      new.price := greatest(coalesce(new.unit_price,0),0);
    end if;

    if coalesce(new.quantity,1)=1 and coalesce(new.qty,1)<>1 then
      new.quantity := greatest(coalesce(new.qty,1),1);
    else
      new.qty := greatest(coalesce(new.quantity,1),1);
    end if;

    if coalesce(new.item_type,'SOLO')='SOLO' and normalized_type<>'SOLO' then
      new.item_type := normalized_type;
    else
      new.type := coalesce(new.item_type,'SOLO');
    end if;
  else
    if new.price is distinct from old.price
       and new.unit_price is not distinct from old.unit_price then
      new.unit_price := greatest(coalesce(new.price,0),0);
    elsif new.unit_price is distinct from old.unit_price
       and new.price is not distinct from old.price then
      new.price := greatest(coalesce(new.unit_price,0),0);
    elsif new.unit_price is distinct from old.unit_price then
      new.price := greatest(coalesce(new.unit_price,0),0);
    end if;

    if new.qty is distinct from old.qty
       and new.quantity is not distinct from old.quantity then
      new.quantity := greatest(coalesce(new.qty,1),1);
    elsif new.quantity is distinct from old.quantity
       and new.qty is not distinct from old.qty then
      new.qty := greatest(coalesce(new.quantity,1),1);
    elsif new.quantity is distinct from old.quantity then
      new.qty := greatest(coalesce(new.quantity,1),1);
    end if;

    if new.type is distinct from old.type
       and new.item_type is not distinct from old.item_type then
      new.item_type := case upper(coalesce(new.type,'SOLO'))
        when 'PACKAGE' then 'PACKAGE'
        when 'PACKAGE_COMPONENT' then 'PACKAGE_COMPONENT'
        when 'CUSTOM' then 'CUSTOM'
        else 'SOLO'
      end;
    elsif new.item_type is distinct from old.item_type
       and new.type is not distinct from old.type then
      new.type := coalesce(new.item_type,'SOLO');
    elsif new.item_type is distinct from old.item_type then
      new.type := coalesce(new.item_type,'SOLO');
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists project_items_compat_trigger on public.project_items;
create trigger project_items_compat_trigger
before insert or update on public.project_items
for each row execute function public.sync_project_item_compat();

drop function if exists public.jp_replace_project_items(uuid,jsonb);

create or replace function public.jp_replace_project_items(p_project_id text,p_items jsonb)
returns void
language plpgsql
security invoker
set search_path=public
as $$
declare
  item jsonb;
  keep_ids text[] := array[]::text[];
  item_id text;
  parent_id text;
begin
  if not public.is_juan_admin() then raise exception 'Admin access required'; end if;
  if not exists(select 1 from public.projects where id=p_project_id) then raise exception 'Project not found'; end if;

  for item in
    select value from jsonb_array_elements(coalesce(p_items,'[]'::jsonb))
    where nullif(value->>'parent_item_id','') is null
  loop
    item_id := coalesce(nullif(item->>'id',''),gen_random_uuid()::text);
    keep_ids := array_append(keep_ids,item_id);
    insert into public.project_items(
      id,project_id,parent_item_id,product_code,name,item_type,quantity,unit_price,
      billable,counts_as_deliverable,status,progress,due_date,completed_at,
      shared_drive_url,client_visible,sort_order
    ) values (
      item_id,p_project_id,null,nullif(item->>'product_code',''),
      coalesce(nullif(item->>'name',''),'Untitled Item'),
      case upper(coalesce(nullif(item->>'item_type',''),'SOLO'))
        when 'PACKAGE' then 'PACKAGE' when 'CUSTOM' then 'CUSTOM' else 'SOLO' end,
      greatest(coalesce((item->>'quantity')::int,1),1),
      greatest(coalesce((item->>'unit_price')::numeric,0),0),
      coalesce((item->>'billable')::boolean,true),
      coalesce((item->>'counts_as_deliverable')::boolean,true),
      coalesce(nullif(item->>'status',''),'Pending'),
      greatest(0,least(100,coalesce((item->>'progress')::int,0))),
      nullif(item->>'due_date','')::date,
      nullif(item->>'completed_at','')::timestamptz,
      nullif(item->>'shared_drive_url',''),
      coalesce((item->>'client_visible')::boolean,true),
      coalesce((item->>'sort_order')::int,0)
    )
    on conflict(id) do update set
      project_id=excluded.project_id,parent_item_id=null,product_code=excluded.product_code,
      name=excluded.name,item_type=excluded.item_type,quantity=excluded.quantity,
      unit_price=excluded.unit_price,billable=excluded.billable,
      counts_as_deliverable=excluded.counts_as_deliverable,status=excluded.status,
      progress=excluded.progress,due_date=excluded.due_date,
      completed_at=excluded.completed_at,shared_drive_url=excluded.shared_drive_url,
      client_visible=excluded.client_visible,sort_order=excluded.sort_order,updated_at=now();
  end loop;

  for item in
    select value from jsonb_array_elements(coalesce(p_items,'[]'::jsonb))
    where nullif(value->>'parent_item_id','') is not null
  loop
    item_id := coalesce(nullif(item->>'id',''),gen_random_uuid()::text);
    parent_id := item->>'parent_item_id';
    if not exists(select 1 from public.project_items where id=parent_id and project_id=p_project_id)
      then raise exception 'Invalid parent_item_id %',parent_id;
    end if;
    keep_ids := array_append(keep_ids,item_id);
    insert into public.project_items(
      id,project_id,parent_item_id,product_code,name,item_type,quantity,unit_price,
      billable,counts_as_deliverable,status,progress,due_date,completed_at,
      shared_drive_url,client_visible,sort_order
    ) values (
      item_id,p_project_id,parent_id,nullif(item->>'product_code',''),
      coalesce(nullif(item->>'name',''),'Package Component'),
      'PACKAGE_COMPONENT',greatest(coalesce((item->>'quantity')::int,1),1),0,false,true,
      coalesce(nullif(item->>'status',''),'Pending'),
      greatest(0,least(100,coalesce((item->>'progress')::int,0))),
      nullif(item->>'due_date','')::date,
      nullif(item->>'completed_at','')::timestamptz,
      nullif(item->>'shared_drive_url',''),
      coalesce((item->>'client_visible')::boolean,true),
      coalesce((item->>'sort_order')::int,0)
    )
    on conflict(id) do update set
      project_id=excluded.project_id,parent_item_id=excluded.parent_item_id,
      name=excluded.name,item_type='PACKAGE_COMPONENT',quantity=excluded.quantity,
      unit_price=0,billable=false,counts_as_deliverable=true,status=excluded.status,
      progress=excluded.progress,due_date=excluded.due_date,
      completed_at=excluded.completed_at,shared_drive_url=excluded.shared_drive_url,
      client_visible=excluded.client_visible,sort_order=excluded.sort_order,updated_at=now();
  end loop;

  if coalesce(array_length(keep_ids,1),0)=0 then
    delete from public.project_items where project_id=p_project_id;
  else
    delete from public.project_items
    where project_id=p_project_id and not (id=any(keep_ids));
  end if;
end;
$$;

grant execute on function public.jp_replace_project_items(text,jsonb) to authenticated;
notify pgrst,'reload schema';
