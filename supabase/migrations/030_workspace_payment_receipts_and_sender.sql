-- JUAN PROJECT Workspace — direct payment sender + optional receipt metadata
alter table if exists public.payments
  add column if not exists sender_institution text,
  add column if not exists receipt_path text,
  add column if not exists receipt_filename text;

comment on column public.payments.sender_institution is 'Normalized sending bank or e-wallet code for Workspace-recorded payments.';
comment on column public.payments.receipt_path is 'Private payment-receipts storage object path for an optional Workspace-uploaded receipt.';
comment on column public.payments.receipt_filename is 'Original receipt filename shown in Workspace payment history.';
