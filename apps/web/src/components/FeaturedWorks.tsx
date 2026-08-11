import { memo } from "react";
import { useWorks } from "~/hooks/useWorks";
import { WorksGrid } from "./WorksGrid";

const FEATURED_COUNT = 6;

export const FeaturedWorks = memo(function FeaturedWorks() {
    const {
        data: works,
        isLoading,
        error,
    } = useWorks("latest", FEATURED_COUNT);

    return (
        <WorksGrid
            works={works}
            isLoading={isLoading}
            error={error}
            placeholderCount={FEATURED_COUNT}
        />
    );
});
