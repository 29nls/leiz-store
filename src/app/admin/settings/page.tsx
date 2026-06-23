"use client";

import { useState, useEffect } from "react";
import { SlideUp } from "@/components/ui/animated";
import {
  Settings,
  Save,
  Loader2,
  Store,
  CreditCard,
  Bell,
  Globe,
  Shield,
  Palette,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";

interface SettingsGroup {
  [key: string]: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, SettingsGroup>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [editedSettings, setEditedSettings] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings");
      const json = await res.json();
      if (json.success) setSettings(json.data);
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    try {
      const updates = Object.entries(editedSettings).map(([key, value]) => {
        const group = Object.keys(settings).find((g) => settings[g][key] !== undefined) || "general";
        return { key, value, group };
      });

      if (updates.length > 0) {
        await fetch("/api/admin/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ settings: updates }),
        });
        setEditedSettings({});
        await fetchSettings();
      }
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setSaving(false);
    }
  }

  const tabs = [
    { id: "general", label: "General", icon: Store },
    { id: "payment", label: "Payment", icon: CreditCard },
    { id: "notification", label: "Notifications", icon: Bell },
    { id: "social", label: "Social", icon: Globe },
    { id: "contact", label: "Contact", icon: Shield },
  ];

  const currentSettings = settings[activeTab] || {};

  return (
    <div className="space-y-8">
      {/* Header */}
      <SlideUp
        delay={0}
        duration={0.5}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-text">Settings</h1>
          <p className="text-sm text-text-muted/60 mt-1">Configure your store settings</p>
        </div>
        {Object.keys(editedSettings).length > 0 && (
          <button
            onClick={saveSettings}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 hover:bg-primary-light transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : `Save Changes (${Object.keys(editedSettings).length})`}
          </button>
        )}
      </SlideUp>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Tabs */}
        <SlideUp
          delay={0.1}
          duration={0.5}
          className="lg:col-span-1"
        >
          <div className="card-premium p-2 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  activeTab === tab.id
                    ? "bg-primary/15 text-primary border border-primary/20"
                    : "text-text-muted hover:text-text hover:bg-surface/60"
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </SlideUp>

        {/* Settings Content */}
        <SlideUp
          delay={0.15}
          duration={0.5}
          className="lg:col-span-4"
        >
          <div className="card-premium p-6">
            <h2 className="text-lg font-semibold text-text mb-6 capitalize">{activeTab} Settings</h2>
            <div className="space-y-5">
              {Object.entries(currentSettings).map(([key, value]) => {
                const edited = editedSettings[key];
                const isEdited = edited !== undefined;
                return (
                  <div key={key}>
                    <label className="block text-xs font-medium text-text-muted/80 uppercase tracking-wider mb-2">
                      {key.replace(/_/g, " ")}
                    </label>
                    <input
                      type="text"
                      value={isEdited ? edited : value}
                      onChange={(e) =>
                        setEditedSettings((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      className={cn(
                        "input-premium",
                        isEdited && "border-primary/40 ring-1 ring-primary/20"
                      )}
                    />
                  </div>
                );
              })}
              {Object.keys(currentSettings).length === 0 && !loading && (
                <div className="text-center py-8 text-sm text-text-muted/40">
                  No settings configured for this section
                </div>
              )}
            </div>
          </div>
        </SlideUp>
      </div>
    </div>
  );
}
