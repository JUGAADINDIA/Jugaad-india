import { useMemo, useState } from "react";

type Listing = {
  id: number;
  title: string;
  price: string;
  category: string;
  location: string;
  emoji: string;
};

const listings: Listing[] = [
  {
    id: 1,
    title: "Second Hand Smartphone",
    price: "₹8,500",
    category: "Mobiles",
    location: "Lucknow",
    emoji: "📱",
  },
  {
    id: 2,
    title: "Wooden Study Table",
    price: "₹2,500",
    category: "Furniture",
    location: "Lucknow",
    emoji: "🪑",
  },
  {
    id: 3,
    title: "Royal Enfield Bike",
    price: "₹95,000",
    category: "Vehicles",
    location: "Kanpur",
    emoji: "🏍️",
  },
  {
    id: 4,
    title: "Home Tutor Available",
    price: "₹300/hr",
    category: "Services",
    location: "Lucknow",
    emoji: "👨‍🏫",
  },
  {
    id: 5,
    title: "Gaming Laptop",
    price: "₹42,000",
    category: "Electronics",
    location: "Delhi",
    emoji: "💻",
  },
  {
    id: 6,
    title: "Sofa Set",
    price: "₹12,000",
    category: "Furniture",
    location: "Lucknow",
    emoji: "🛋️",
  },
];

const categories = [
  ["📱", "Mobiles"],
  ["🚗", "Vehicles"],
  ["🪑", "Furniture"],
  ["💻", "Electronics"],
  ["🏠", "Property"],
  ["🛠️", "Services"],
];

export default function App() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  const filteredListings = useMemo(() => {
    return listings.filter((item) => {
      const matchesCategory =
        category === "All" || item.category === category;

      const text =
        `${item.title} ${item.category} ${item.location}`.toLowerCase();

      return matchesCategory && text.includes(search.toLowerCase());
    });
  }, [search, category]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4">
          <div className="min-w-fit">
            <div className="text-2xl font-black tracking-tight text-orange-600">
              JUGAAD
            </div>
            <div className="text-[10px] font-bold tracking-[0.25em] text-slate-500">
              INDIA
            </div>
          </div>

          <div className="hidden items-center gap-2 rounded-xl border px-4 py-2 md:flex">
            <span>📍</span>
            <span className="text-sm font-medium">India</span>
          </div>

          <div className="flex flex-1 items-center rounded-xl border bg-slate-50 px-3">
            <span className="text-lg">🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products, services..."
              className="w-full bg-transparent px-3 py-3 text-sm outline-none"
            />
          </div>

          <button className="hidden rounded-xl border px-4 py-3 text-sm font-semibold md:block">
            Login
          </button>

          <button className="rounded-xl bg-orange-600 px-4 py-3 text-sm font-bold text-white shadow-sm">
            + Sell / Post Ad
          </button>
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-7xl px-4 py-8">
        <section className="rounded-3xl bg-gradient-to-r from-orange-600 to-amber-500 p-6 text-white md:p-10">
          <div className="max-w-2xl">
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-orange-100">
              Local Marketplace
            </p>

            <h1 className="text-3xl font-black leading-tight md:text-5xl">
              Buy, Sell & Find Services Near You
            </h1>

            <p className="mt-4 max-w-xl text-orange-50">
              JUGAAD India connects local buyers, sellers and service providers
              in one simple marketplace.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button className="rounded-xl bg-white px-5 py-3 font-bold text-orange-600">
                Explore Listings
              </button>
              <button className="rounded-xl border border-white/50 px-5 py-3 font-bold">
                Post an Ad
              </button>
            </div>
          </div>
        </section>

        {/* Categories */}
        <section className="py-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">Browse Categories</h2>
            <button
              onClick={() => setCategory("All")}
              className="text-sm font-semibold text-orange-600"
            >
              View All
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
            {categories.map(([icon, name]) => (
              <button
                key={name}
                onClick={() => setCategory(name)}
                className={`rounded-2xl border bg-white p-4 text-center transition hover:-translate-y-1 hover:shadow-md ${
                  category === name
                    ? "border-orange-500 ring-2 ring-orange-100"
                    : ""
                }`}
              >
                <div className="text-3xl">{icon}</div>
                <div className="mt-2 text-sm font-semibold">{name}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Listings */}
        <section className="pb-12">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Latest Listings</h2>
              <p className="mt-1 text-sm text-slate-500">
                Fresh products and services from local sellers
              </p>
            </div>

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-xl border bg-white px-3 py-2 text-sm"
            >
              <option value="All">All Categories</option>
              {categories.map(([, name]) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {filteredListings.length === 0 ? (
            <div className="rounded-2xl border bg-white p-12 text-center">
              <div className="text-4xl">🔎</div>
              <h3 className="mt-3 font-bold">No listings found</h3>
              <p className="mt-1 text-sm text-slate-500">
                Try another search or category.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {filteredListings.map((item) => (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="flex h-40 items-center justify-center bg-orange-50 text-7xl">
                    {item.emoji}
                  </div>

                  <div className="p-4">
                    <div className="mb-1 text-xs font-semibold text-orange-600">
                      {item.category}
                    </div>

                    <h3 className="line-clamp-2 min-h-12 font-bold">
                      {item.title}
                    </h3>

                    <div className="mt-3 text-xl font-black">
                      {item.price}
                    </div>

                    <div className="mt-2 text-xs text-slate-500">
                      📍 {item.location}
                    </div>

                    <button className="mt-4 w-full rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white">
                      View Details
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="font-black text-orange-600">JUGAAD INDIA</div>
          <p className="mt-2 text-sm text-slate-500">
            Buy • Sell • Services — Your Local Marketplace
          </p>
          <p className="mt-5 text-xs text-slate-400">
            © 2026 JUGAAD India. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
