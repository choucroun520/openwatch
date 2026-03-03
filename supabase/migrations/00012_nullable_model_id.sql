-- Allow listings without a model_id (for imported/scraped inventory)
ALTER TABLE listings ALTER COLUMN model_id DROP NOT NULL;
