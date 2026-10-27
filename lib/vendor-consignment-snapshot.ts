export type SupplierConsignmentVendor = {
  id: string;
  supplierConsignmentEnabled: boolean;
  furmosaShareBps: number | null;
} | null | undefined;

export type SupplierConsignmentSnapshot = {
  supplierVendorIdSnapshot: string | null;
  supplierFurmosaShareBpsSnapshot: number | null;
};

/** Freeze supplier settlement terms on the order line; never recalculate old sales from current vendor settings. */
export function supplierConsignmentSnapshot(
  vendor: SupplierConsignmentVendor,
): SupplierConsignmentSnapshot {
  if (
    !vendor?.supplierConsignmentEnabled ||
    !Number.isInteger(vendor.furmosaShareBps) ||
    vendor.furmosaShareBps == null ||
    vendor.furmosaShareBps < 0 ||
    vendor.furmosaShareBps > 10_000
  ) {
    return {
      supplierVendorIdSnapshot: null,
      supplierFurmosaShareBpsSnapshot: null,
    };
  }

  return {
    supplierVendorIdSnapshot: vendor.id,
    supplierFurmosaShareBpsSnapshot: vendor.furmosaShareBps,
  };
}
