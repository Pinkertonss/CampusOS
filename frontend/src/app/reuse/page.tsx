"use client";

import { useEffect, useState } from "react";
import {
  Repeat,
  DollarSign,
  Leaf,
  CheckCircle2,
  Plus,
  Tag,
  Package,
  Book,
  Cpu,
  Sparkles,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import {
  getReuseItems,
  getImpactMetrics,
  createReuseItem,
  claimReuseItem,
  completeReuseItem,
} from "../../lib/api";
import { ReuseItem, ImpactMetrics } from "../../types";

const CATEGORIES = [
  { key: "all", label: "All Items" },
  { key: "electronics", label: "Calculators & Tech" },
  { key: "lab_gear", label: "Lab Coats & Drafters" },
  { key: "books", label: "Textbooks & Notes" },
  { key: "hostel_essentials", label: "Hostel Essentials" },
];

const LISTING_TYPES = [
  { key: "all", label: "All Types" },
  { key: "donate", label: "Donate (Free)" },
  { key: "exchange", label: "Exchange" },
  { key: "borrow", label: "Borrow" },
];

export default function ReusePage() {
  const [items, setItems] = useState<ReuseItem[]>([]);
  const [impact, setImpact] = useState<ImpactMetrics | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [loading, setLoading] = useState(true);

  // New item modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("electronics");
  const [listingType, setListingType] = useState("donate");
  const [condition, setCondition] = useState("good");
  const [price, setPrice] = useState("1400");
  const [weight, setWeight] = useState("0.3");
  const [contact, setContact] = useState("Hostel J, Room 204");

  const loadData = async () => {
    try {
      const [itms, imp] = await Promise.all([
        getReuseItems({ category: selectedCategory, listing_type: selectedType }),
        getImpactMetrics(),
      ]);
      setItems(itms);
      setImpact(imp);
    } catch (e) {
      console.error("Reuse load error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCategory, selectedType]);

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) return;
    try {
      await createReuseItem({
        title,
        description,
        category,
        listing_type: listingType,
        condition,
        estimated_retail_price: parseFloat(price) || 500,
        estimated_weight_kg: parseFloat(weight) || 0.5,
        contact_info: contact,
      });
      setShowAddModal(false);
      setTitle("");
      setDescription("");
      loadData();
    } catch (err) {
      alert("Failed to list item: " + err);
    }
  };

  const handleClaim = async (itemId: string) => {
    try {
      await claimReuseItem(itemId, {
        requester_name: "Gurasees Singh",
        requester_contact: "102203099@thapar.edu",
      });
      loadData();
    } catch (err) {
      alert("Claim failed: " + err);
    }
  };

  const handleComplete = async (itemId: string) => {
    try {
      await completeReuseItem(itemId);
      loadData();
    } catch (err) {
      alert("Error marking exchange complete: " + err);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-950 text-purple-300 border border-purple-800 flex items-center gap-1">
              <Repeat className="w-3 h-3" /> Circular Campus Economy
            </span>
            <span className="text-xs text-slate-400">TIET Patiala Pilot</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            Campus Reuse &amp; Impact Tracking
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Exchange, donate, or borrow calculators, lab gear, and textbooks. Track collective campus savings.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-md shadow-purple-950 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> List an Item
        </button>
      </div>

      {/* REAL-TIME IMPACT TRACKING DASHBOARD */}
      <div className="bg-gradient-to-r from-slate-900 via-purple-950/30 to-slate-900 p-6 rounded-2xl border border-purple-800/40 shadow-xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
              Collective Sustainability &amp; Economic Impact
            </span>
            <h2 className="text-lg font-bold text-white mt-0.5">
              Thapar Institute Campus Circularity
            </h2>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> Live Metrics
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-xs text-slate-400">Student Money Saved</span>
            <div className="text-2xl font-bold text-emerald-400 mt-1">
              ₹{impact ? impact.total_money_saved_inr.toLocaleString() : "6,400"}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">From avoided retail purchases</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-xs text-slate-400">Landfill Waste Diverted</span>
            <div className="text-2xl font-bold text-amber-400 mt-1">
              {impact ? impact.total_waste_diverted_kg : "17.15"} kg
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Plastics, paper, and hardware</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-xs text-slate-400">CO2 Emissions Avoided</span>
            <div className="text-2xl font-bold text-purple-400 mt-1">
              {impact ? impact.co2_avoided_kg : "42.02"} kg CO₂
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Equivalent to 2.1 trees grown</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-xs text-slate-400">Completed Exchanges</span>
            <div className="text-2xl font-bold text-blue-400 mt-1">
              {impact ? impact.total_exchanges_completed : "3"} Items
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Across Hostels &amp; Departments</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2 overflow-x-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat.key
                  ? "bg-purple-600 text-white font-semibold"
                  : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {LISTING_TYPES.map((t) => (
            <button
              key={t.key}
              onClick={() => setSelectedType(t.key)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                selectedType === t.key
                  ? "bg-slate-700 text-white font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Item Listings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item) => {
          const isCompleted = item.status === "completed";
          const isRequested = item.status === "requested";

          return (
            <div
              key={item.id}
              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                isCompleted
                  ? "bg-slate-900/40 border-slate-800/60 opacity-70"
                  : "bg-slate-900 border-slate-800 hover:border-slate-700 shadow-md"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span
                    className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                      item.listing_type === "donate"
                        ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                        : item.listing_type === "borrow"
                        ? "bg-blue-950 text-blue-300 border border-blue-800"
                        : "bg-purple-950 text-purple-300 border border-purple-800"
                    }`}
                  >
                    {item.listing_type}
                  </span>

                  <span
                    className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                      isCompleted
                        ? "bg-slate-800 text-slate-400"
                        : isRequested
                        ? "bg-amber-950 text-amber-300 border border-amber-800"
                        : "bg-emerald-950 text-emerald-300 border border-emerald-800"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-white line-clamp-1">{item.title}</h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  {item.description}
                </p>

                <div className="mt-4 p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs space-y-1 font-mono">
                  <div className="flex justify-between text-slate-400">
                    <span>Retail Value:</span>
                    <span className="text-white font-bold">₹{item.estimated_retail_price}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Weight / Footprint:</span>
                    <span className="text-slate-300">{item.estimated_weight_kg} kg</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Condition:</span>
                    <span className="text-slate-300 capitalize">{item.condition.replace("_", " ")}</span>
                  </div>
                </div>

                <div className="mt-3 text-[11px] text-slate-400 truncate">
                  📍 {item.contact_info}
                </div>
              </div>

              {/* Actions */}
              <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500 truncate">By {item.user_name}</span>

                {!isCompleted && (
                  <div className="flex items-center gap-1.5">
                    {item.status === "available" && (
                      <button
                        onClick={() => handleClaim(item.id)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
                      >
                        Request
                      </button>
                    )}
                    <button
                      onClick={() => handleComplete(item.id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white transition-colors"
                    >
                      Exchanged ✓
                    </button>
                  </div>
                )}

                {isCompleted && (
                  <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Reused
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL: POST REUSE ITEM */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">List Campus Essential for Reuse</h3>
            <form onSubmit={handleCreateItem} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Item Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Casio FX-991EX Scientific Calculator"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
                <textarea
                  required
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Details on condition, year, textbook edition..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm"
                  >
                    <option value="electronics">Electronics / Calculator</option>
                    <option value="lab_gear">Lab Gear (Coats / Drafter)</option>
                    <option value="books">Textbooks / Notes</option>
                    <option value="hostel_essentials">Hostel Essentials</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Listing Type</label>
                  <select
                    value={listingType}
                    onChange={(e) => setListingType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm"
                  >
                    <option value="donate">Donate (Free)</option>
                    <option value="exchange">Exchange</option>
                    <option value="borrow">Borrow</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Retail (₹)</label>
                  <input
                    type="number"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Condition</label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm"
                  >
                    <option value="like_new">Like New</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Contact / Hostel Room
                </label>
                <input
                  type="text"
                  required
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="Hostel J, Room 204 | Roll: 102203099"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-xs font-semibold text-white shadow"
                >
                  Publish Listing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
