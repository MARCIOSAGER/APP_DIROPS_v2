-- Migration 007: Add extra fields to empresa table
ALTER TABLE public.empresa ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.empresa ADD COLUMN IF NOT EXISTS nif TEXT;
ALTER TABLE public.empresa ADD COLUMN IF NOT EXISTS endereco TEXT;
ALTER TABLE public.empresa ADD COLUMN IF NOT EXISTS telefone TEXT;
ALTER TABLE public.empresa ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.empresa ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE public.empresa ADD COLUMN IF NOT EXISTS observacoes TEXT;
