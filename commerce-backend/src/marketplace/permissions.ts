import { PermissionDefinition } from '@vendure/core';

// These deliberately grant no native catalog, order, settings or administrator permission.
// Every delegated operation goes through a store/owner-scoped resolver instead.
export const ManageStore = new PermissionDefinition({
    name: 'ManageStore',
    description:
        'Manage sales, catalog, delivery, offline payments and sellers in the assigned store',
});
export const SellOwnProducts = new PermissionDefinition({
    name: 'SellOwnProducts',
    description:
        'Manage only the assigned seller catalog and its portions of store orders',
});
