"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import ListingCard from "./listing-card";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import { MATERIALS, CONDITIONS } from "@/lib/constants";
import type { ListingWithRelations, Brand } from "@/lib/types";

interface NetworkGridProps {
  listings: ListingWithRelations[];
  brands: Brand[];
}

export default function NetworkGrid({ listings, brands }: NetworkGridProps) {
  const [activeBrand, setActiveBrand] = useState<string | null>(null);
  const [conditionFilter, setConditionFilter] = useState<string>("");
  const [materialFilter, setMaterialFilter] = useState<string>("");
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [sort, setSort] = useState<string>("newest");

  // Stats
  const uniqueDealerCount = useMemo(
    () => new Set(listings.map((l) => l.dealer_id)).size,
    [listings]
  );
  const uniqueBrandCount = useMemo(
    () => new Set(listings.map((l) => l.brand_id)).size,
    [listings]
  );
  const avgPrice = useMemo(() => {
    if (!listings.length) return 0;
    const sum = listings.reduce(
      (acc, l) => acc + parseFloat(l.wholesale_price),
      0
    );
    return sum / listings.length;
  }, [listings]);

  // Filtering
  const filtered = useMemo(() => {
    let result = [...listings];

    if (activeBrand) {
      result = result.filter((l) => l.brand.name === activeBrand);
    }
    if (conditionFilter && conditionFilter !== "all") {
      result = result.filter((l) => l.condition === conditionFilter);
    }
    if (materialFilter && materialFilter !== "all") {
      result = result.filter((l) => l.material === materialFilter);
    }
    if (minPrice) {
      const min = parseFloat(minPrice);
      if (!isNaN(min)) {
        result = result.filter((l) => parseFloat(l.wholesale_price) >= min);
      }
    }
    if (maxPrice) {
      const max = parseFloat(maxPrice);
      if (!isNaN(max)) {
        result = result.filter((l) => parseFloat(l.wholesale_price) <= max);
      }
    }

    // Sort
    switch (sort) {
      case "newest":
        result.sort(
          (a, b) =>
            new Date(b.listed_at).getTime() - new Date(a.listed_at).getTime()
        );
        break;
      case "price-asc":
        result.sort(
          (a, b) => parseFloat(a.wholesale_price) - parseFloat(b.wholesale_price)
        );
        break;
      case "price-desc":
        result.sort(
          (a, b) => parseFloat(b.wholesale_price) - parseFloat(a.wholesale_price)
        );
        break;
      case "views":
        result.sort((a, b) => b.views - a.views);
        break;
    }

    return result;
  }, [listings, activeBrand, conditionFilter, materialFilter, minPrice, maxPrice, sort]);

  const stats = [
    { label: "Network Listings", value: listings.length.toString() },
    { label: "Active Dealers", value: uniqueDealerCount.toString() },
    { label: "Brands", value: uniqueBrandCount.toString() },
    { label: "Avg Floor", value: formatCurrency(avgPrice) },
  ];

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-bg-card border border-border rounded-lg p-4"
          >
            <p className="text-xs text-[#475569] uppercase tracking-wider">
              {stat.label}
            </p>
            <p className="text-lg font-bold font-mono text-foreground mt-1">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Brand filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {(["All", ...brands.map((b) => b.name)] as string[]).map((name) => {
          const isAll = name === "All";
          const isActive = isAll
            ? activeBrand === null
            : activeBrand === name;

          return (
            <button
              key={name}
              onClick={() => setActiveBrand(isAll ? null : name)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0",
                isActive
                  ? "bg-blue-600 text-white"
                  : "bg-bg-elevated text-muted-foreground hover:text-foreground border border-border"
              )}
            >
              {name}
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={conditionFilter}
          onValueChange={setConditionFilter}
        >
          <SelectTrigger className="w-36 h-8 text-sm bg-bg-elevated border-border">
            <SelectValue placeholder="Condition" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Conditions</SelectItem>
            {CONDITIONS.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={materialFilter}
          onValueChange={setMaterialFilter}
        >
          <SelectTrigger className="w-40 h-8 text-sm bg-bg-elevated border-border">
            <SelectValue placeholder="Material" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Materials</SelectItem>
            {MATERIALS.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-2">
          <Input
            placeholder="Min $"
            type="number"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className="w-24 h-8 text-sm bg-bg-elevated border-border"
          />
          <Input
            placeholder="Max $"
            type="number"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="w-24 h-8 text-sm bg-bg-elevated border-border"
          />
        </div>

        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-36 h-8 text-sm bg-bg-elevated border-border">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="price-asc">Price: Low to High</SelectItem>
            <SelectItem value="price-desc">Price: High to Low</SelectItem>
            <SelectItem value="views">Most Viewed</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-sm text-muted-foreground ml-auto">
          {filtered.length} {filtered.length === 1 ? "watch" : "watches"}
        </span>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          heading="No watches found"
          subtext="Try adjusting your filters"
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      )}
    </div>
  );
}
