-- Seed data for assets table
-- Run after schema.sql

INSERT INTO public.assets (id, name, asset_type, sector, twelve_data_symbol, finnhub_symbol, is_active) VALUES
-- Stocks
('AAPL', 'Apple Inc.', 'stock', 'Tech', 'AAPL', 'AAPL', true),
('MSFT', 'Microsoft Corp.', 'stock', 'Tech', 'MSFT', 'MSFT', true),
('GOOGL', 'Alphabet Inc.', 'stock', 'Tech', 'GOOGL', 'GOOGL', true),
('AMZN', 'Amazon.com Inc.', 'stock', 'Tech', 'AMZN', 'AMZN', true),
('NVDA', 'NVIDIA Corp.', 'stock', 'Tech', 'NVDA', 'NVDA', true),
('TSLA', 'Tesla Inc.', 'stock', 'Tech', 'TSLA', 'TSLA', true),
('META', 'Meta Platforms Inc.', 'stock', 'Tech', 'META', 'META', true),
('JPM', 'JPMorgan Chase & Co.', 'stock', 'Finance', 'JPM', 'JPM', true),
('V', 'Visa Inc.', 'stock', 'Finance', 'V', 'V', true),
('WMT', 'Walmart Inc.', 'stock', 'Consumer', 'WMT', 'WMT', true),
('JNJ', 'Johnson & Johnson', 'stock', 'Healthcare', 'JNJ', 'JNJ', true),
('XOM', 'Exxon Mobil Corp.', 'stock', 'Energy', 'XOM', 'XOM', true),
('BAC', 'Bank of America Corp.', 'stock', 'Finance', 'BAC', 'BAC', true),
('PG', 'Procter & Gamble Co.', 'stock', 'Consumer', 'PG', 'PG', true),
('MA', 'Mastercard Inc.', 'stock', 'Finance', 'MA', 'MA', true),
('UNH', 'UnitedHealth Group Inc.', 'stock', 'Healthcare', 'UNH', 'UNH', true),
('HD', 'Home Depot Inc.', 'stock', 'Consumer', 'HD', 'HD', true),
('DIS', 'Walt Disney Co.', 'stock', 'Consumer', 'DIS', 'DIS', true),
('NFLX', 'Netflix Inc.', 'stock', 'Tech', 'NFLX', 'NFLX', true),
('AMD', 'Advanced Micro Devices Inc.', 'stock', 'Tech', 'AMD', 'AMD', true),
('CRM', 'Salesforce Inc.', 'stock', 'Tech', 'CRM', 'CRM', true),
('INTC', 'Intel Corp.', 'stock', 'Tech', 'INTC', 'INTC', true),
('PFE', 'Pfizer Inc.', 'stock', 'Healthcare', 'PFE', 'PFE', true),
('KO', 'Coca-Cola Co.', 'stock', 'Consumer', 'KO', 'KO', true),
('PEP', 'PepsiCo Inc.', 'stock', 'Consumer', 'PEP', 'PEP', true),
('COST', 'Costco Wholesale Corp.', 'stock', 'Consumer', 'COST', 'COST', true),
('ABBV', 'AbbVie Inc.', 'stock', 'Healthcare', 'ABBV', 'ABBV', true),
('MRK', 'Merck & Co. Inc.', 'stock', 'Healthcare', 'MRK', 'MRK', true),
('TMO', 'Thermo Fisher Scientific Inc.', 'stock', 'Healthcare', 'TMO', 'TMO', true),
('AVGO', 'Broadcom Inc.', 'stock', 'Tech', 'AVGO', 'AVGO', true),

-- Crypto
('BTC/USD', 'Bitcoin', 'crypto', 'Crypto', 'BTC/USD', NULL, true),
('ETH/USD', 'Ethereum', 'crypto', 'Crypto', 'ETH/USD', NULL, true),
('SOL/USD', 'Solana', 'crypto', 'Crypto', 'SOL/USD', NULL, true),
('BNB/USD', 'BNB', 'crypto', 'Crypto', 'BNB/USD', NULL, true),
('XRP/USD', 'XRP', 'crypto', 'Crypto', 'XRP/USD', NULL, true),
('ADA/USD', 'Cardano', 'crypto', 'Crypto', 'ADA/USD', NULL, true),
('DOGE/USD', 'Dogecoin', 'crypto', 'Crypto', 'DOGE/USD', NULL, true),

-- Metals
('XAU/USD', 'Gold', 'metal', 'Metals', 'XAU/USD', NULL, true),
('XAG/USD', 'Silver', 'metal', 'Metals', 'XAG/USD', NULL, true),
('XPT/USD', 'Platinum', 'metal', 'Metals', 'XPT/USD', NULL, true),

-- FX
('EUR/USD', 'Euro / US Dollar', 'fx', 'FX', 'EUR/USD', NULL, true),
('GBP/USD', 'British Pound / US Dollar', 'fx', 'FX', 'GBP/USD', NULL, true),
('USD/JPY', 'US Dollar / Japanese Yen', 'fx', 'FX', 'USD/JPY', NULL, true),
('USD/CHF', 'US Dollar / Swiss Franc', 'fx', 'FX', 'USD/CHF', NULL, true),
('AUD/USD', 'Australian Dollar / US Dollar', 'fx', 'FX', 'AUD/USD', NULL, true)

ON CONFLICT (id) DO NOTHING;
