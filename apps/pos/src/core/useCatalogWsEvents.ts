import { useEffect } from "react";
import { wsClient } from "./ws-client.js";
import { adminApi } from "./admin-api.js";
import { useAdminStore } from "../state/admin-store.js";

/**
 * Keeps the shared catalog/config store (products, categories, production centers,
 * option groups, payment methods, printers) in sync across terminals: any admin change
 * made from another cash register arrives here as a WS event and triggers a refetch of
 * the affected list, so every open POS screen reflects it without a manual refresh.
 */
export function useCatalogWsEvents() {
  const setCategories = useAdminStore((s) => s.setCategories);
  const setProducts = useAdminStore((s) => s.setProducts);
  const setProductionCenters = useAdminStore((s) => s.setProductionCenters);
  const setOptionGroups = useAdminStore((s) => s.setOptionGroups);
  const setPaymentMethods = useAdminStore((s) => s.setPaymentMethods);
  const setPrinters = useAdminStore((s) => s.setPrinters);

  useEffect(() => {
    const refetchCategories = () => { adminApi.categories.list().then(setCategories).catch(() => {}); };
    const refetchProducts = () => { adminApi.products.list().then(setProducts).catch(() => {}); };
    const refetchProductionCenters = () => { adminApi.productionCenters.list().then(setProductionCenters).catch(() => {}); };
    const refetchPaymentMethods = () => { adminApi.paymentMethods.list().then(setPaymentMethods).catch(() => {}); };
    const refetchPrinters = () => { adminApi.printers.list().then(setPrinters).catch(() => {}); };
    const refetchOptionGroups = (productId: string) => {
      adminApi.optionGroups.list(productId).then((groups) => setOptionGroups(productId, groups)).catch(() => {});
    };

    const unsubs = [
      wsClient.on("CATEGORY_CREATED", refetchCategories),
      wsClient.on("CATEGORY_UPDATED", refetchCategories),
      wsClient.on("CATEGORY_DELETED", refetchCategories),
      wsClient.on("PRODUCT_CREATED", refetchProducts),
      wsClient.on("PRODUCT_UPDATED", refetchProducts),
      wsClient.on("PRODUCT_DELETED", refetchProducts),
      wsClient.on("PRODUCTION_CENTER_CREATED", refetchProductionCenters),
      wsClient.on("PRODUCTION_CENTER_UPDATED", refetchProductionCenters),
      wsClient.on("PRODUCTION_CENTER_DELETED", refetchProductionCenters),
      wsClient.on("PAYMENT_METHOD_CREATED", refetchPaymentMethods),
      wsClient.on("PAYMENT_METHOD_UPDATED", refetchPaymentMethods),
      wsClient.on("PAYMENT_METHOD_DELETED", refetchPaymentMethods),
      wsClient.on("PRINTER_CREATED", refetchPrinters),
      wsClient.on("PRINTER_UPDATED", refetchPrinters),
      wsClient.on("PRINTER_DELETED", refetchPrinters),
      wsClient.on("OPTION_GROUP_CREATED", (p) => refetchOptionGroups(p.productId)),
      wsClient.on("OPTION_GROUP_UPDATED", (p) => refetchOptionGroups(p.productId)),
      wsClient.on("OPTION_GROUP_DELETED", (p) => refetchOptionGroups(p.productId)),
      wsClient.on("OPTION_CREATED", (p) => {
        const productId = findProductIdForOptionGroup(p.optionGroupId);
        if (productId) refetchOptionGroups(productId);
      }),
      wsClient.on("OPTION_UPDATED", (p) => {
        const productId = findProductIdForOptionGroup(p.optionGroupId);
        if (productId) refetchOptionGroups(productId);
      }),
      wsClient.on("OPTION_DELETED", (p) => {
        const productId = findProductIdForOptionGroup(p.optionGroupId);
        if (productId) refetchOptionGroups(productId);
      }),
    ];

    function findProductIdForOptionGroup(optionGroupId: string): string | null {
      const byProduct = useAdminStore.getState().optionGroupsByProduct;
      for (const [productId, groups] of Object.entries(byProduct)) {
        if (groups.some((g) => g.id === optionGroupId)) return productId;
      }
      return null;
    }

    return () => { for (const unsub of unsubs) unsub(); };
  }, [setCategories, setProducts, setProductionCenters, setOptionGroups, setPaymentMethods, setPrinters]);
}
