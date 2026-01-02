import { useState, useEffect, useMemo, useCallback } from 'react';
import { useStore } from '@/core/store';
import { MerchandiseService, CatalogProduct } from '@/services/merchandise/MerchandiseService';
import { MerchProduct } from '../types';

export const useMerchandise = () => {
    const { userProfile } = useStore();
    const [products, setProducts] = useState<MerchProduct[]>([]);
    const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [catalogError, setCatalogError] = useState<Error | null>(null);

    useEffect(() => {
        if (!userProfile?.id) return;

        setLoading(true);

        // Subscribe to user's products
        const unsubscribe = MerchandiseService.subscribeToProducts(userProfile.id, (data) => {
            setProducts(data);
            setLoading(false);
        });

        // Load product catalog templates
        MerchandiseService.getCatalog()
            .then(setCatalog)
            .catch(error => {
                console.error("Failed to load catalog:", error);
                setCatalogError(error);
            })
            .finally(() => {
                 // Note: loading state is primarily controlled by the subscription above,
                 // but we ensure catalog fetch doesn't hang indefinitely if we were using a separate loader.
                 // Since we share 'loading' for both, we rely on the subscription to flip it to false
                 // which is a continuous stream.
                 // However, for correctness, we might want separate loading states,
                 // but for now catching the error is the primary fix.
            });

        return () => unsubscribe?.();
    }, [userProfile?.id]);

    const standardProducts = useMemo(() => products.filter(p => p.category === 'standard'), [products]);
    const proProducts = useMemo(() => products.filter(p => p.category === 'pro'), [products]);

    const createFromCatalog = useCallback(async (catalogId: string, customizations?: {
        title?: string;
        price?: string;
        image?: string;
    }) => {
        if (!userProfile?.id) throw new Error('User not authenticated');
        return MerchandiseService.createFromCatalog(catalogId, userProfile.id, customizations);
    }, [userProfile?.id]);

    return {
        products,
        standardProducts,
        proProducts,
        catalog,
        loading,
        catalogError,
        addProduct: MerchandiseService.addProduct,
        deleteProduct: MerchandiseService.deleteProduct,
        createFromCatalog
    };
};
