-- Make optional listing fields nullable for scraped/imported inventory
ALTER TABLE listings ALTER COLUMN material DROP NOT NULL;
ALTER TABLE listings ALTER COLUMN year DROP NOT NULL;
ALTER TABLE listings ALTER COLUMN dial_color DROP NOT NULL;
ALTER TABLE listings ALTER COLUMN case_size DROP NOT NULL;
ALTER TABLE listings ALTER COLUMN movement DROP NOT NULL;
ALTER TABLE listings ALTER COLUMN condition_score DROP NOT NULL;
