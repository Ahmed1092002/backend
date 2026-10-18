-- Cursor pagination filters by product and continues after the last
-- (createdAt, id) pair. This expands indexing safely; the earlier
-- productId/createdAt index stays in place until production evidence says
-- it is redundant.
CREATE INDEX "InventoryMovement_productId_createdAt_id_idx"
ON "InventoryMovement"("productId", "createdAt", "id");
