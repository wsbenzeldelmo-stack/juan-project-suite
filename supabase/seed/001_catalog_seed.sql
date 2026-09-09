-- Optional starting catalog. Safe to edit before running.
insert into public.catalog_categories(name,slug,sort_order) values
('TV Broadcast Graphics','tv-broadcast-graphics',10),('Animation','animation',20),('Tutorials','tutorials',30)
on conflict(slug) do nothing;

with c as (select id,slug from public.catalog_categories)
insert into public.catalog_services(category_id,name,description,price)
select c.id,v.name,v.description,v.price from c join (values
('tv-broadcast-graphics','Studio','5 still shots',3000::numeric),
('tv-broadcast-graphics','Lower Thirds','Custom lower third graphics',1000::numeric),
('animation','Logo Animation','Logo animation service',2000::numeric),
('tv-broadcast-graphics','Stinger','Broadcast transition stinger',500::numeric),
('tv-broadcast-graphics','Channel Ident','Channel identification bumper',800::numeric),
('tutorials','Blender Tutorial','One tutorial session',1500::numeric)
) v(slug,name,description,price) on v.slug=c.slug
where not exists(select 1 from public.catalog_services s where lower(s.name)=lower(v.name));
