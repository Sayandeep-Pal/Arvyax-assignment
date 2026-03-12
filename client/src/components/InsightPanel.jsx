/**
 * Displays aggregated insights for a user fetched from the insights API.
 *
 * Props:
 * - insights {Object|null} The insights payload, or null while loading.
 * - loading  {boolean}     Whether the insights are still being fetched.
 * - error    {string|null} Error message if the fetch failed.
 */
export default function InsightPanel({ insights, loading, error }) {
  if (loading) return <p className="loading">Loading insights…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!insights) return null;

  return (
    <section className="insight-panel">
      <h2>Your Insights</h2>
      <div className="insight-grid">
        <div className="insight-card">
          <span className="insight-value">{insights.totalEntries}</span>
          <span className="insight-label">Total Entries</span>
        </div>

        <div className="insight-card">
          <span className="insight-value">{insights.topEmotion ?? "—"}</span>
          <span className="insight-label">Top Emotion</span>
        </div>

        <div className="insight-card">
          <span className="insight-value">{insights.mostUsedAmbience ?? "—"}</span>
          <span className="insight-label">Favourite Ambience</span>
        </div>
      </div>

      {insights.recentKeywords.length > 0 && (
        <div className="keyword-section">
          <strong>Recent Keywords:</strong>
          <div className="keyword-pills">
            {insights.recentKeywords.map((kw) => (
              <span key={kw} className="keyword-pill">
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
