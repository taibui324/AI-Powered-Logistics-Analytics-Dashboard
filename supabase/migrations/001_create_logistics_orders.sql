create table if not exists public.logistics_orders (
  client_id text not null,
  order_id text primary key,
  order_date date not null,
  delivery_date date,
  carrier text not null,
  origin_city text not null,
  destination_city text not null,
  status text not null,
  sku text not null,
  product_category text not null,
  quantity integer not null,
  unit_price_usd numeric(10, 2) not null,
  order_value_usd numeric(12, 2) not null,
  is_promo boolean not null,
  promo_discount_pct numeric(5, 2) not null,
  region text not null,
  warehouse text not null,
  constraint logistics_orders_status_check
    check (status in ('delivered', 'delayed', 'in_transit', 'exception', 'canceled')),
  constraint logistics_orders_quantity_check check (quantity >= 0),
  constraint logistics_orders_money_check check (unit_price_usd >= 0 and order_value_usd >= 0),
  constraint logistics_orders_discount_check check (promo_discount_pct >= 0 and promo_discount_pct <= 100),
  constraint logistics_orders_delivery_date_check check (delivery_date is null or delivery_date >= order_date)
);

alter table public.logistics_orders enable row level security;

revoke all on table public.logistics_orders from anon, authenticated;
grant select on table public.logistics_orders to anon, authenticated;

drop policy if exists logistics_orders_readonly_select on public.logistics_orders;
create policy logistics_orders_readonly_select
  on public.logistics_orders
  for select
  to anon, authenticated
  using (true);

create index if not exists logistics_orders_order_date_idx
  on public.logistics_orders (order_date);

create index if not exists logistics_orders_status_idx
  on public.logistics_orders (status);

create index if not exists logistics_orders_carrier_idx
  on public.logistics_orders (carrier);

create index if not exists logistics_orders_region_idx
  on public.logistics_orders (region);

create index if not exists logistics_orders_warehouse_idx
  on public.logistics_orders (warehouse);

create index if not exists logistics_orders_product_category_idx
  on public.logistics_orders (product_category);

create index if not exists logistics_orders_sku_idx
  on public.logistics_orders (sku);
