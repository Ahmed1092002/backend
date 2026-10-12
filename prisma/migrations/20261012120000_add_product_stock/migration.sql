-- Existing products begin with zero known stock. This expansion is safe for
-- current rows and lets new application versions write the stock value.
ALTER TABLE "Product" ADD COLUMN "stock" INTEGER NOT NULL DEFAULT 0;
