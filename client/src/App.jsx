import { useState, useEffect, useCallback } from "react";
import { getEntries, getInsights } from "./services/api";
import JournalForm from "./components/JournalForm";
import EntryList from "./components/EntryList";
import InsightPanel from "./components/InsightPanel";
import "./App.css";

const DEFAULT_USER = "demo-user";

/**
 * Root application component.
 *
 * Manages global state for journal entries, insights, and the active user ID.
 * On mount (and whenever userId changes) it fetches entries and insights from
 * the Express API.
 */
export default function App() {
  const [userId, setUserId] = useState(DEFAULT_USER);
  const [entries, setEntries] = useState([]);
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState(null);

  const refreshInsights = useCallback(async () => {
    if (!userId.trim()) return;
    setInsightsLoading(true);
    setInsightsError(null);
    try {
      const data = await getInsights(userId.trim());
      setInsights(data);
    } catch (err) {
      setInsightsError(err.response?.data?.error || "Failed to load insights.");
    } finally {
      setInsightsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId.trim()) {
      setEntries([]);
      setInsights(null);
      setInsightsError(null);
      return;
    }
    const fetchAll = async () => {
      try {
        const data = await getEntries(userId.trim());
        setEntries(data);
      } catch {
        setEntries([]);
      }
      await refreshInsights();
    };
    fetchAll();
  }, [userId, refreshInsights]);

  const handleEntryCreated = async (entry) => {
    setEntries((prev) => [entry, ...prev]);
    await refreshInsights();
  };

  const handleEntryUpdated = async (updated) => {
    setEntries((prev) => prev.map((e) => (e._id === updated._id ? updated : e)));
    await refreshInsights();
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>ArvyaX Nature Journal</h1>
        <div className="user-bar">
          <label htmlFor="userId">User ID:</label>
          <input
            id="userId"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            onBlur={(e) => { if (!e.target.value.trim()) setUserId(DEFAULT_USER); }}
            placeholder="Enter user ID"
          />
        </div>
      </header>

      <main className="app-main">
        <aside className="sidebar">
          <JournalForm userId={userId} onCreated={handleEntryCreated} />
          <InsightPanel
            insights={insights}
            loading={insightsLoading}
            error={insightsError}
          />
        </aside>

        <section className="content">
          <EntryList entries={entries} onUpdated={handleEntryUpdated} />
        </section>
      </main>
    </div>
  );
}
