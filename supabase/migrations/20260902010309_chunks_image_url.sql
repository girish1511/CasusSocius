-- Reference to an extracted embedded image (chart/diagram) whose Claude-
-- generated description was folded into this chunk's content. Nullable,
-- additive — most chunks have no associated image.
alter table chunks
  add column image_url text;
