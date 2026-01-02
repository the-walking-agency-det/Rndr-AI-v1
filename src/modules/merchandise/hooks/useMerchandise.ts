import { useState, useEffect, useMemo } from 'react';
import { useStore } from '@/core/store';
import { MerchandiseService } from '@/services/merchandise/MerchandiseService';
import { MerchProduct } from '../types';

export const useMerchandise = () => {
    // Select only needed state from Zustand to prevent unnecessary re-renders
    const userProfile = useStore((state) => state.userProfile);
    const [products, setProducts] = useState<MerchProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [catalogError, setCatalogError] = useState<Error | null>(null);

    useEffect(() => {
        if (!userProfile?.id) return;

        let unsubscribe: (() => void) | undefined;

        const init = async () => {
            setLoading(true);
            try {
                // Ensure seeding completes before subscribing to avoid race condition
                await MerchandiseService.seedDatabase(userProfile.id);
            } catch (e) {
                console.error("Failed to seed merchandise:", e);
                // We don't block subscription on seed failure, but we log it
            }

            // Load product catalog templates
            try {
                const catalog = await MerchandiseService.getCatalog();
                // We could do something with the catalog here if needed,
                // e.g., set it to a state if the UI needs to display templates.
                // For now, we just ensure it loads without error.
            } catch (error) {
                console.error("Failed to load catalog:", error);
                setCatalogError(error as Error);
            }

            // Subscribe after seeding/catalog check
            unsubscribe = MerchandiseService.subscribeToProducts(userProfile.id, (data) => {
                setProducts(data);
                setLoading(false);
            });
        };

        init();

        return () => unsubscribe?.();
    }, [userProfile?.id]);

    const standardProducts = useMemo(() => products.filter(p => p.category === 'standard'), [products]);
    const proProducts = useMemo(() => products.filter(p => p.category === 'pro'), [products]);

    return {
        products,
        standardProducts,
        proProducts,
        loading,
        catalogError,
        addProduct: MerchandiseService.addProduct,
        deleteProduct: MerchandiseService.deleteProduct
    };
};
