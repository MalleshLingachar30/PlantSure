ALTER TABLE "plantation_sites"
ADD COLUMN "planting_photo_urls" jsonb DEFAULT '[]'::jsonb NOT NULL;
